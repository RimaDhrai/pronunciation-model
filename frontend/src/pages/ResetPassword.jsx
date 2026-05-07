import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "http://localhost:8080";

const C = {
  bg:    "#FEF8F3",
  teal:  "#80DCDC",
  pink:  "#E8476A",
  navy:  "#1E2D5A",
  text:  "#2D3142",
  muted: "#7B8199",
  card:  "#FFFFFF",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getPasswordStrength(pw) {
  let s = 0;
  if (pw.length >= 8)              s++;
  if (/[A-Z]/.test(pw))           s++;
  if (/[0-9]/.test(pw))           s++;
  if (/[^A-Za-z0-9]/.test(pw))    s++;
  return s;
}

const strengthLabel = ["", "Faible", "Moyen", "Bon", "Fort"];
const strengthColor = ["", C.pink, "#f59e0b", "#3b82f6", C.teal];

function PasswordCriteria({ pw }) {
  const checks = [
    { label: "8 caractères minimum", ok: pw.length >= 8 },
    { label: "Une majuscule",         ok: /[A-Z]/.test(pw) },
    { label: "Un chiffre",            ok: /[0-9]/.test(pw) },
    { label: "Un caractère spécial",  ok: /[^A-Za-z0-9]/.test(pw) },
  ];
  return (
    <ul style={{ listStyle:"none", margin:"8px 0 0", padding:0, fontSize:13 }}>
      {checks.map(c => (
        <li key={c.label} style={{ color: c.ok ? C.teal : C.muted, display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
          <span style={{ fontSize:15 }}>{c.ok ? "✓" : "○"}</span> {c.label}
        </li>
      ))}
    </ul>
  );
}

export default function ResetPassword() {
  const [params]    = useSearchParams();
  const navigate    = useNavigate();
  const token       = params.get("token") || "";

  const [password,   setPassword]   = useState("");
  const [confirm,    setConfirm]    = useState("");
  const [showPw,     setShowPw]     = useState(false);
  const [showCfm,    setShowCfm]    = useState(false);
  const [showCrit,   setShowCrit]   = useState(false);
  const [error,      setError]      = useState("");
  const [success,    setSuccess]    = useState(false);
  const [loading,    setLoading]    = useState(false);

  const strength = getPasswordStrength(password);

  useEffect(() => {
    if (!token) setError("Lien invalide. Refais une demande de réinitialisation.");
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!password) return setError("Saisis ton nouveau mot de passe.");
    if (strength < 2) return setError("Mot de passe trop faible.");
    if (password !== confirm) return setError("Les mots de passe ne correspondent pas.");

    setLoading(true);
    try {
      await axios.post(`${API}/auth/reset-password`, { token, password });
      setSuccess(true);
      setTimeout(() => navigate("/login"), 3000);
    } catch (err) {
      const msg = err.response?.data?.message;
      if (msg) setError(msg);
      else if (err.response?.status === 400) setError("Lien invalide ou expiré. Refais une demande.");
      else setError("Erreur serveur. Réessaie dans un instant.");
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    width: "100%", padding: "12px 14px", borderRadius: 10, fontSize: 15,
    border: `1.5px solid #e8ddd4`, outline: "none", background: "#fff",
    color: C.text, boxSizing: "border-box",
  };

  return (
    <div style={{ minHeight:"100vh", background: C.bg, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{
        background: C.card, borderRadius: 20, padding: "40px 36px",
        boxShadow: "0 8px 40px rgba(232,71,106,0.10)", width: "100%", maxWidth: 420,
      }}>
        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{
            width:52, height:52, borderRadius:14, background:`linear-gradient(135deg,${C.teal},${C.pink})`,
            display:"inline-flex", alignItems:"center", justifyContent:"center", marginBottom:12,
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path d="M12 2a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z" fill="white"/>
              <path d="M6 10a6 6 0 0 0 12 0" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none"/>
              <line x1="12" y1="19" x2="12" y2="22" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              <line x1="8" y1="22" x2="16" y2="22" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <h1 style={{ fontSize:22, fontWeight:700, color: C.navy, margin:0 }}>Nouveau mot de passe</h1>
          <p style={{ color: C.muted, fontSize:14, marginTop:6 }}>Choisis un mot de passe sécurisé</p>
        </div>

        {success ? (
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:52, marginBottom:12 }}>✅</div>
            <p style={{ color: C.navy, fontWeight:600, fontSize:16 }}>Mot de passe mis à jour !</p>
            <p style={{ color: C.muted, fontSize:14 }}>Redirection vers la connexion...</p>
            <Link to="/login" style={{ color: C.pink, fontWeight:600, fontSize:14 }}>Aller à la connexion</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            {/* Nouveau mot de passe */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display:"block", fontSize:13, fontWeight:600, color: C.text, marginBottom:6 }}>
                Nouveau mot de passe
              </label>
              <div style={{ position:"relative" }}>
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onFocus={() => setShowCrit(true)}
                  onBlur={() => setShowCrit(false)}
                  placeholder="Nouveau mot de passe"
                  style={{ ...inputStyle, paddingRight: 44 }}
                  disabled={!token}
                />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)",
                    background:"none", border:"none", cursor:"pointer", color: C.muted, fontSize:18 }}>
                  {showPw ? "🙈" : "👁"}
                </button>
              </div>

              {/* Barre de force */}
              {password && (
                <div style={{ marginTop:8 }}>
                  <div style={{ display:"flex", gap:4, marginBottom:4 }}>
                    {[1,2,3,4].map(i => (
                      <div key={i} style={{
                        flex:1, height:4, borderRadius:4,
                        background: i <= strength ? strengthColor[strength] : "#e8ddd4",
                        transition:"background 0.3s",
                      }}/>
                    ))}
                  </div>
                  <span style={{ fontSize:12, color: strengthColor[strength], fontWeight:600 }}>
                    {strengthLabel[strength]}
                  </span>
                </div>
              )}

              {showCrit && <PasswordCriteria pw={password} />}
            </div>

            {/* Confirmer */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display:"block", fontSize:13, fontWeight:600, color: C.text, marginBottom:6 }}>
                Confirmer le mot de passe
              </label>
              <div style={{ position:"relative" }}>
                <input
                  type={showCfm ? "text" : "password"}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Confirme ton mot de passe"
                  style={{
                    ...inputStyle, paddingRight: 44,
                    border: confirm && `1.5px solid ${confirm === password ? C.teal : C.pink}`,
                  }}
                  disabled={!token}
                />
                <button type="button" onClick={() => setShowCfm(v => !v)}
                  style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)",
                    background:"none", border:"none", cursor:"pointer", color: C.muted, fontSize:18 }}>
                  {showCfm ? "🙈" : "👁"}
                </button>
              </div>
              {confirm && (
                <span style={{ fontSize:12, color: confirm === password ? C.teal : C.pink, marginTop:4, display:"block" }}>
                  {confirm === password ? "✓ Les mots de passe correspondent" : "✗ Ne correspondent pas"}
                </span>
              )}
            </div>

            {/* Erreur */}
            {error && (
              <div style={{
                background:"#fff0f3", border:`1px solid ${C.pink}`, borderRadius:8,
                padding:"10px 14px", color: C.pink, fontSize:13, marginBottom:16,
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !token}
              style={{
                width:"100%", padding:"13px", borderRadius:10, border:"none",
                background: loading ? "#ccc" : `linear-gradient(135deg,${C.pink},#c0364f)`,
                color:"#fff", fontSize:16, fontWeight:700, cursor: loading ? "not-allowed" : "pointer",
                transition:"opacity 0.2s",
              }}
            >
              {loading ? "Mise à jour..." : "Réinitialiser le mot de passe"}
            </button>

            <div style={{ textAlign:"center", marginTop:16 }}>
              <Link to="/login" style={{ color: C.pink, fontSize:14, fontWeight:500 }}>
                ← Retour à la connexion
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
