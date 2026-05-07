import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import {
  kcLogin, kcLogout, decodeToken, mapKcUser,
  storeTokens, clearTokens, getStoredToken, getStoredRefresh,
} from '../api/keycloakAuth';
import { registerUser, getMe, updateProgress } from '../api/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [ready,   setReady]   = useState(false);

  /* ── Restauration de session au démarrage ──────────────────────
     Si un token Keycloak est en localStorage on recharge le profil
     Spring Boot (pour avoir le statut CEFR à jour).               */
  useEffect(() => {
    const token = getStoredToken();
    if (!token) { setReady(true); return; }

    const payload = decodeToken(token);
    if (!payload) { clearTokens(); setReady(true); return; }

    const base = mapKcUser(payload);
    getMe()
      .then((res) => setUser({ ...base, ...res.data }))
      .catch(()  => setUser(base))
      .finally(()=> setReady(true));
  }, []);

  /* ── Login ─────────────────────────────────────────────────────
     1. POST /realms/talan/protocol/openid-connect/token  (Keycloak)
     2. Décode le JWT → infos utilisateur (email, nom, rôles LDAP)
     3. Appel Spring Boot /api/user/me → statut CEFR + données app  */
  const login = useCallback(async (email, password) => {
    setLoading(true);
    try {
      const res = await kcLogin(email, password);
      storeTokens(res.data);

      const payload  = decodeToken(res.data.access_token);
      const baseUser = mapKcUser(payload);

      try {
        const meRes   = await getMe();
        const full    = { ...baseUser, ...meRes.data };
        setUser(full);
        return full;
      } catch {
        // Spring Boot inaccessible → on affiche quand même l'utilisateur Keycloak
        setUser(baseUser);
        return baseUser;
      }
    } finally {
      setLoading(false);
    }
  }, []);

  /* ── Register ──────────────────────────────────────────────────
     Spring Boot crée l'utilisateur dans Keycloak via l'Admin API,
     puis on fait un login Keycloak pour obtenir les tokens.        */
  const register = useCallback(async (data) => {
    setLoading(true);
    try {
      // 1. Spring Boot crée le compte dans Keycloak
      await registerUser(data);

      // 2. Login Keycloak avec les credentials qui viennent d'être créés
      const res = await kcLogin(data.email, data.password);
      storeTokens(res.data);

      const payload  = decodeToken(res.data.access_token);
      const baseUser = mapKcUser(payload);

      try {
        const meRes = await getMe();
        const full  = { ...baseUser, ...meRes.data };
        setUser(full);
        return full;
      } catch {
        setUser(baseUser);
        return baseUser;
      }
    } finally {
      setLoading(false);
    }
  }, []);

  /* ── Logout ────────────────────────────────────────────────────
     Invalide le refresh_token côté Keycloak + nettoie le localStorage */
  const logout = useCallback(async () => {
    const refresh = getStoredRefresh();
    if (refresh) {
      try { await kcLogout(refresh); } catch {}
    }
    clearTokens();
    setUser(null);
  }, []);

  /* ── Mise à jour du profil (CEFR, progression) ─────────────────
     Optimistic update local + sync Spring Boot                     */
  const updateUser = useCallback(async (data) => {
    setUser(prev => prev ? { ...prev, ...data } : data);
    try { await updateProgress(data); } catch (err) { console.error('[updateUser]', err); }
  }, []);

  const getCefrLevel = useCallback((lang = 'fr') => {
    if (lang === 'en') return user?.cefrLevelEn || user?.cefr_level_en || null;
    return user?.cefrLevel || user?.level || user?.cefr_level || null;
  }, [user]);

  const isCefrCompleted = useCallback((lang = 'fr') => {
    if (lang === 'en') return !!(user?.cefrCompletedEn || user?.cefr_completed_en);
    return !!(user?.cefrCompleted || user?.cefr_completed);
  }, [user]);

  /* ── Loading screen ────────────────────────────────────────────── */
  if (!ready) return (
    <div className="min-h-screen flex items-center justify-center"
         style={{ background: '#FEF8F3' }}>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:14 }}>
        <div style={{ width:52, height:52, borderRadius:14, background:'linear-gradient(135deg,#80DCDC,#4DBFBF)', display:'flex', alignItems:'center', justifyContent:'center', animation:'pulse 1.5s ease-in-out infinite' }}>
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
            <path stroke="white" strokeWidth="2" strokeLinecap="round"
              d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path stroke="white" strokeWidth="2" strokeLinecap="round"
              d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/>
          </svg>
        </div>
        <p style={{ fontWeight:600, fontSize:'0.85rem', color:'#9BB0C2' }}>Connexion en cours…</p>
      </div>
    </div>
  );

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, setUser, updateUser, getCefrLevel, isCefrCompleted }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export default AuthContext;
