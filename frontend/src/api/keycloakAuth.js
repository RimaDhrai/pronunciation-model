/**
 * keycloakAuth.js
 * Appels directs à l'API REST Keycloak (Direct Access Grants)
 * — Pas de redirection vers la page Keycloak
 * — Notre interface Login.jsx reste utilisée
 */
import axios from 'axios';

// /kc est proxifié par Vite vers http://localhost:8090 → évite CORS quand accès par IP
const KC_BASE   = '/kc';
const KC_REALM  = 'talan';
const KC_CLIENT = 'talan-frontend';

const TOKEN_URL  = `${KC_BASE}/realms/${KC_REALM}/protocol/openid-connect/token`;
const LOGOUT_URL = `${KC_BASE}/realms/${KC_REALM}/protocol/openid-connect/logout`;

/* ── Appels Keycloak ────────────────────────────────────────────── */

/** Connexion : username + password → access_token + refresh_token */
export const kcLogin = (username, password) =>
  axios.post(TOKEN_URL,
    new URLSearchParams({ grant_type: 'password', client_id: KC_CLIENT, username, password }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

/** Rafraîchir le token avant expiration */
export const kcRefresh = (refreshToken) =>
  axios.post(TOKEN_URL,
    new URLSearchParams({ grant_type: 'refresh_token', client_id: KC_CLIENT, refresh_token: refreshToken }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

/** Déconnexion : invalide le refresh_token côté Keycloak */
export const kcLogout = (refreshToken) =>
  axios.post(LOGOUT_URL,
    new URLSearchParams({ client_id: KC_CLIENT, refresh_token: refreshToken }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

/* ── Stockage des tokens ────────────────────────────────────────── */

export const storeTokens = ({ access_token, refresh_token, expires_in }) => {
  localStorage.setItem('kc_token',      access_token);
  localStorage.setItem('kc_refresh',    refresh_token);
  localStorage.setItem('kc_expires_at', String(Date.now() + expires_in * 1000));
};

export const clearTokens = () => {
  localStorage.removeItem('kc_token');
  localStorage.removeItem('kc_refresh');
  localStorage.removeItem('kc_expires_at');
};

export const getStoredToken   = () => localStorage.getItem('kc_token');
export const getStoredRefresh = () => localStorage.getItem('kc_refresh');
export const getTokenExpiry   = () => parseInt(localStorage.getItem('kc_expires_at') || '0');

/**
 * Retourne un access_token valide.
 * Si le token expire dans moins de 60s, le rafraîchit automatiquement.
 */
export const getValidToken = async () => {
  const expiry = getTokenExpiry();
  const token  = getStoredToken();
  if (!token) return null;
  // Si le token expire dans moins de 60 secondes, on le rafraîchit
  if (expiry - Date.now() < 60_000) {
    const refresh = getStoredRefresh();
    if (refresh) {
      try {
        const res = await kcRefresh(refresh);
        storeTokens(res.data);
        return res.data.access_token;
      } catch {
        // Refresh token expiré → on retourne le token actuel, Spring renverra 401
      }
    }
  }
  return token;
};

/* ── Décodage JWT → infos utilisateur ──────────────────────────── */

export const decodeToken = (token) => {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch { return null; }
};

/**
 * Extrait les infos utilisateur des claims Keycloak.
 * Fonctionne avec les utilisateurs locaux ET LDAP (les attributs LDAP
 * sont mappés automatiquement par Keycloak via User Federation).
 */
export const mapKcUser = (payload) => ({
  id:        payload.sub,
  email:     payload.email || payload.preferred_username || '',
  fullName:  payload.name  || payload.preferred_username || '',
  firstName: payload.given_name  || '',
  lastName:  payload.family_name || '',
  username:  payload.preferred_username || '',
  roles:     payload.realm_access?.roles || [],
  // CEFR status vient de Spring Boot (pas de Keycloak)
  cefrCompleted: false,
  cefrLevel:     null,
});
