import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

// ─── Change these to whatever you want ────────────────────────────────────
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin';
// ──────────────────────────────────────────────────────────────────────────

const T = {
  fr: {
    title: "Administration",
    subtitle: "SpeakCoach AI — Espace réservé",
    error: "Identifiants incorrects. Vérifiez votre nom d'utilisateur et mot de passe.",
    username: "Nom d'utilisateur",
    password: "Mot de passe",
    checking: "Vérification…",
    login: "Accéder au panneau admin",
    back: "← Retour à l'application",
    footer: "Accès réservé au personnel autorisé"
  },
  en: {
    title: "Administration",
    subtitle: "SpeakCoach AI — Restricted Area",
    error: "Invalid credentials. Please check your username and password.",
    username: "Username",
    password: "Password",
    checking: "Verifying…",
    login: "Access admin panel",
    back: "← Back to application",
    footer: "Access restricted to authorized personnel"
  }
};

export default function AdminLogin() {
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const t = T[lang] || T.fr;

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Simulate a small delay for UX
    await new Promise(r => setTimeout(r, 600));

    if (username.trim().toLowerCase() === ADMIN_USER && password === ADMIN_PASS) {
      sessionStorage.setItem('sc_admin_auth', '1');
      navigate('/admin', { replace: true });
    } else {
      setError(t.error);
    }
    setLoading(false);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{
        background: 'linear-gradient(135deg, #1a1c2e 0%, #16213e 50%, #0f3460 100%)',
        fontFamily: 'var(--font-body)',
      }}
    >
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-indigo-600/10 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-violet-600/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md px-6">

        {/* Card */}
        <div
          className="rounded-3xl p-8 border border-white/10 shadow-2xl animate-fade-up"
          style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(24px)' }}
        >
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-4">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="font-heading font-extrabold text-2xl text-white">{t.title}</h1>
            <p className="text-slate-400 text-sm mt-1">{t.subtitle}</p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl px-4 py-3 text-sm mb-5 animate-fade-up">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username */}
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">
                {t.username}
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="admin"
                required
                autoFocus
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
                autoComplete="username"
              />
            </div>

            {/* Password */}
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">
                {t.password}
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  required
                  className="w-full px-4 py-3 pr-12 rounded-xl border border-white/10 bg-white/5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full py-3.5 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2.5 transition-all disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                boxShadow: '0 8px 20px rgba(99,102,241,0.35)',
              }}
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> {t.checking}</>
                : <><Shield className="w-4 h-4" /> {t.login}</>
              }
            </button>
          </form>

          {/* Back */}
          <div className="text-center mt-6">
            <a href="/dashboard" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
              {t.back}
            </a>
          </div>
        </div>

        <p className="text-center text-[10px] text-slate-600 mt-6 uppercase tracking-widest">
          {t.footer}
        </p>
      </div>
    </div>
  );
}
