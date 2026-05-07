import { useState, useEffect } from "react";
import adminApi from "../../api/adminAxios";
import AdminLayout from "../../components/layout/AdminLayout";
import { useLanguage } from "../../context/LanguageContext";

const C = {
  bg: "#F8F9FA", white: "#FFFFFF", teal: "#80DCDC", tealDark: "#4DBFBF",
  pink: "#E8476A", border: "#E2E8F0", dark: "#1C2B3A", mid: "#5F7183", muted: "#9BB0C2",
};

const T = {
  fr: {
    pageTitle: "Configuration Email SMTP",
    subtitle: "Paramètres d'envoi des emails (réinitialisation de mot de passe, notifications)",
    configuredMsg: "✓ Configuration email active — laisse le mot de passe vide pour ne pas le modifier",
    emailRequired: "L'adresse email est requise",
    pwdRequired: "Le mot de passe est requis pour la première configuration",
    saveError: "Erreur de sauvegarde",
    testError: "Connexion échouée",
    testRequire: "Remplis email et mot de passe pour tester",
    smtpServer: "Serveur SMTP",
    port: "Port",
    senderEmail: "Adresse email expéditeur",
    pwdNew: "Nouveau mot de passe (laisser vide = inchangé)",
    pwd: "Mot de passe",
    pwdPlaceholder: "Mot de passe email",
    displayName: "Nom affiché (expéditeur)",
    presets: "Presets SMTP",
    btnTest: "🔌 Tester la connexion",
    btnTesting: "Test en cours…",
    btnSave: "💾 Sauvegarder",
    btnSaving: "Sauvegarde…",
  },
  en: {
    pageTitle: "SMTP Email Configuration",
    subtitle: "Email sending parameters (password reset, notifications)",
    configuredMsg: "✓ Email configuration active — leave password empty to keep current",
    emailRequired: "Email address is required",
    pwdRequired: "Password is required for the initial configuration",
    saveError: "Save error",
    testError: "Connection failed",
    testRequire: "Fill in email and password to test",
    smtpServer: "SMTP Server",
    port: "Port",
    senderEmail: "Sender email address",
    pwdNew: "New password (leave empty = unchanged)",
    pwd: "Password",
    pwdPlaceholder: "Email password",
    displayName: "Display name (sender)",
    presets: "SMTP Presets",
    btnTest: "🔌 Test connection",
    btnTesting: "Testing…",
    btnSave: "💾 Save",
    btnSaving: "Saving…",
  }
};

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.mid, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "10px 14px", borderRadius: 10,
  border: `1.5px solid ${C.border}`, background: C.white,
  fontSize: 14, color: C.dark, outline: "none", boxSizing: "border-box",
};

export default function AdminMailSettings() {
  const { lang } = useLanguage();
  const t = T[lang] || T.fr;

  const [form, setForm]     = useState({ host: "smtp.office365.com", port: 587, username: "", password: "", fromName: "SpeakCoach AI" });
  const [msg, setMsg]       = useState(null);
  const [msgType, setMsgType] = useState("ok");
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [configured, setConfigured] = useState(false);

  useEffect(() => {
    adminApi.get("/api/admin/mail-settings").then(r => {
      if (r.data.configured) {
        setForm(prev => ({ ...prev, ...r.data, password: "" }));
        setConfigured(true);
      }
    }).catch(() => {});
  }, []);

  const showMsg = (text, type = "ok") => {
    setMsg(text); setMsgType(type);
    setTimeout(() => setMsg(null), 4000);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.username) return showMsg(t.emailRequired, "err");
    if (!configured && !form.password) return showMsg(t.pwdRequired, "err");
    setLoading(true);
    try {
      const r = await adminApi.put("/api/admin/mail-settings", { ...form, port: Number(form.port) });
      showMsg(r.data.message, "ok");
      setConfigured(true);
      setForm(prev => ({ ...prev, password: "" }));
    } catch (err) {
      showMsg(err.response?.data?.message || t.saveError, "err");
    }
    setLoading(false);
  };

  const handleTest = async () => {
    if (!form.username || !form.password) return showMsg(t.testRequire, "err");
    setTesting(true);
    try {
      const r = await adminApi.post("/api/admin/mail-settings/test", { ...form, port: Number(form.port) });
      showMsg(r.data.message, "ok");
    } catch (err) {
      showMsg(err.response?.data?.message || t.testError, "err");
    }
    setTesting(false);
  };

  return (
    <AdminLayout title={t.pageTitle}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "24px 16px" }}>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontWeight: 800, fontSize: 20, color: C.dark, margin: "0 0 4px" }}>
            ✉️ {t.pageTitle}
          </h2>
          <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>
            {t.subtitle}
          </p>
        </div>

        {configured && (
          <div style={{ background: "#EDFCF5", border: "1.5px solid #22C55E30", borderRadius: 10, padding: "10px 14px", marginBottom: 20, fontSize: 13, color: "#15803D", fontWeight: 600 }}>
            {t.configuredMsg}
          </div>
        )}

        {msg && (
          <div style={{
            background: msgType === "ok" ? "#EDFCF5" : "#FEF2F2",
            border: `1.5px solid ${msgType === "ok" ? "#22C55E30" : "#EF444430"}`,
            borderRadius: 10, padding: "10px 14px", marginBottom: 20,
            fontSize: 13, color: msgType === "ok" ? "#15803D" : "#DC2626", fontWeight: 600,
          }}>
            {msg}
          </div>
        )}

        <form onSubmit={handleSave} style={{ background: C.white, borderRadius: 16, border: `1.5px solid ${C.border}`, padding: 24, boxShadow: "0 2px 12px rgba(28,43,58,0.06)" }}>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 100px", gap: 12 }}>
            <Field label={t.smtpServer}>
              <input style={inputStyle} value={form.host} onChange={e => setForm({ ...form, host: e.target.value })} placeholder="smtp.office365.com" />
            </Field>
            <Field label={t.port}>
              <input style={inputStyle} type="number" value={form.port} onChange={e => setForm({ ...form, port: e.target.value })} />
            </Field>
          </div>

          <Field label={t.senderEmail}>
            <input style={inputStyle} type="email" value={form.username}
              onChange={e => setForm({ ...form, username: e.target.value })}
              placeholder="votre.email@outlook.com" />
          </Field>

          <Field label={configured ? t.pwdNew : t.pwd}>
            <input style={inputStyle} type="password" value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              placeholder={configured ? "••••••••" : t.pwdPlaceholder} />
          </Field>

          <Field label={t.displayName}>
            <input style={inputStyle} value={form.fromName}
              onChange={e => setForm({ ...form, fromName: e.target.value })}
              placeholder="SpeakCoach AI" />
          </Field>

          {/* Presets */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>{t.presets}</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                { label: "Outlook", host: "smtp.office365.com", port: 587 },
                { label: "Gmail",   host: "smtp.gmail.com",     port: 587 },
                { label: "Yahoo",   host: "smtp.mail.yahoo.com",port: 465 },
              ].map(p => (
                <button key={p.label} type="button"
                  onClick={() => setForm(prev => ({ ...prev, host: p.host, port: p.port }))}
                  style={{
                    padding: "6px 14px", borderRadius: 8, border: `1.5px solid ${C.border}`,
                    background: form.host === p.host ? C.teal : C.bg,
                    color: form.host === p.host ? "white" : C.dark,
                    fontSize: 12, fontWeight: 700, cursor: "pointer",
                  }}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={handleTest} disabled={testing}
              style={{
                flex: 1, padding: "11px", borderRadius: 10, border: `1.5px solid ${C.teal}`,
                background: "white", color: C.tealDark, fontSize: 14, fontWeight: 700, cursor: "pointer",
                opacity: testing ? 0.65 : 1,
              }}>
              {testing ? t.btnTesting : t.btnTest}
            </button>
            <button type="submit" disabled={loading}
              style={{
                flex: 1, padding: "11px", borderRadius: 10, border: "none",
                background: C.pink, color: "white", fontSize: 14, fontWeight: 800, cursor: "pointer",
                opacity: loading ? 0.65 : 1,
              }}>
              {loading ? t.btnSaving : t.btnSave}
            </button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
