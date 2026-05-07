import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { forgotPassword } from '../api/auth';
import { Mic, Eye, EyeOff, ArrowRight, Mail, CheckCircle, Loader2 } from 'lucide-react';

const TL = {
  fr: {
    tagline:          "Parle, prononce, progresse",
    tagline2:         "à ton rythme avec l'IA.",
    badge:            "SpeakCoach IA — Actif",
    title_login:      "Bon retour ! 👋",
    title_signup:     "Rejoins-nous ! 🎯",
    sub_login:        "Continue ta progression vers la maîtrise parfaite.",
    sub_signup:       "Rejoins des milliers d'apprenants SpeakCoach.",
    tab_login:        "Connexion",
    tab_signup:       "S'inscrire",
    label_first:      "Prénom",
    label_last:       "Nom",
    label_email:      "Adresse email",
    label_pw:         "Mot de passe",
    ph_first:         "Jean",
    ph_last:          "Dupont",
    ph_email:         "jean@exemple.com",
    btn_login:        "Se connecter",
    btn_signup:       "Créer mon compte",
    switch_login:     "Pas encore de compte ? ",
    switch_signup:    "Déjà inscrit ? ",
    switch_btn_login: "S'inscrire gratuitement",
    switch_btn_signup:"Se connecter",
    trust:            "+200 apprenants satisfaits",
    back:             "← Retour à l'accueil",
    error_default:    "Identifiants incorrects ou serveur indisponible",
    fp_link:          "Mot de passe oublié ?",
    fp_title:         "Réinitialisation 🔑",
    fp_sub:           "Saisis ton email — si le compte existe, tu recevras un lien sécurisé dans quelques minutes.",
    fp_label:         "Ton adresse email",
    fp_btn:           "Envoyer le lien",
    fp_sending:       "Envoi en cours…",
    fp_back:          "← Retour à la connexion",
    fp_sent_title:    "Email envoyé ! 📬",
    fp_sent_sub:      "Si cet email est enregistré, tu recevras un lien de réinitialisation. Pense à vérifier tes spams.",
    fp_sent_btn:      "Retour à la connexion",
    fp_error:         "Erreur serveur. Réessaie dans un instant.",
  },
  en: {
    tagline:          "Speak, pronounce, progress",
    tagline2:         "at your own pace with AI.",
    badge:            "SpeakCoach AI — Active",
    title_login:      "Welcome back! 👋",
    title_signup:     "Join us! 🎯",
    sub_login:        "Continue your journey toward perfect pronunciation.",
    sub_signup:       "Join thousands of SpeakCoach learners.",
    tab_login:        "Login",
    tab_signup:       "Sign up",
    label_first:      "First name",
    label_last:       "Last name",
    label_email:      "Email address",
    label_pw:         "Password",
    ph_first:         "John",
    ph_last:          "Doe",
    ph_email:         "john@example.com",
    btn_login:        "Sign in",
    btn_signup:       "Create my account",
    switch_login:     "No account yet? ",
    switch_signup:    "Already registered? ",
    switch_btn_login: "Sign up for free",
    switch_btn_signup:"Sign in",
    trust:            "+200 satisfied learners",
    back:             "← Back to home",
    error_default:    "Incorrect credentials or server unavailable",
    fp_link:          "Forgot password?",
    fp_title:         "Reset password 🔑",
    fp_sub:           "Enter your email — if the account exists, you'll receive a secure link in a few minutes.",
    fp_label:         "Your email address",
    fp_btn:           "Send reset link",
    fp_sending:       "Sending…",
    fp_back:          "← Back to login",
    fp_sent_title:    "Email sent! 📬",
    fp_sent_sub:      "If this email is registered, you'll receive a reset link. Don't forget to check your spam folder.",
    fp_sent_btn:      "Back to login",
    fp_error:         "Server error. Please try again in a moment.",
  },
};

/* ── Google Fonts ─────────────────────────────────────────────────── */
const _fl = document.createElement('link');
_fl.rel = 'stylesheet';
_fl.href = 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap';
if (!document.querySelector('[href*="Nunito"]')) document.head.appendChild(_fl);

/* ── Palette identique Landing page ──────────────────────────────── */
const C = {
  bg:        '#FEF8F3',
  white:     '#FFFFFF',
  dark:      '#1C2B3A',
  mid:       '#5F7183',
  muted:     '#9BB0C2',
  border:    '#EEE8E0',
  vert:      '#80DCDC',   /* Vert d'Eau — panneau gauche */
  vertDark:  '#4DBFBF',
  vertDeep:  '#2E9898',
  teal:      '#80DCDC',
  tealDark:  '#4DBFBF',
  tealSoft:  '#E8F9F9',
  coral:     '#E8926A',
  coralSoft: '#FEF3EC',
  violet:    '#9580D4',
  gold:      '#F0C85A',
  pink:      '#E8476A',
  pinkDark:  '#C8305A',
};

/* ── styles ────────────────────────────────────────────────────────── */
const styles = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  .auth-root {
    min-height: 100vh; display: flex;
    font-family: 'Plus Jakarta Sans', 'Nunito', sans-serif;
    background: ${C.bg};
  }

  /* ══════════════════════════════
     LEFT PANEL — Vert d'Eau gradient
  ══════════════════════════════ */
  .auth-left {
    display: none; width: 46%;
    position: relative; overflow: hidden;
    background: linear-gradient(150deg, #80DCDC 0%, #4DBFBF 45%, #2E9898 100%);
    flex-direction: column;
    align-items: center; justify-content: center;
  }
  @media (min-width: 1024px) { .auth-left { display: flex; } }

  /* Blobs blancs subtils */
  .auth-blob { position: absolute; border-radius: 50%; pointer-events: none; background: rgba(255,255,255,0.07); }
  .auth-blob-1 { width: 340px; height: 340px; top: -110px; right: -90px; }
  .auth-blob-2 { width: 240px; height: 240px; bottom: -80px; left: -70px; }
  .auth-blob-3 { width: 180px; height: 180px; top: 38%; left: -50px; background: rgba(255,255,255,0.04); }

  /* Anneaux roses — style Ascent */
  .auth-ring {
    position: absolute; border-radius: 50%; pointer-events: none;
    border-style: solid; border-color: ${C.pink};
  }
  .auth-ring-1 { width: 110px; height: 110px; border-width: 4px; top: 10%;    left: -36px;  opacity: 0.85; }
  .auth-ring-2 { width: 58px;  height: 58px;  border-width: 3px; top: 44%;    left: -14px;  opacity: 0.55; }
  .auth-ring-3 { width: 128px; height: 128px; border-width: 4px; bottom: 8%;  right: -44px; opacity: 0.80; }
  .auth-ring-4 { width: 68px;  height: 68px;  border-width: 3px; top: 6%;     right: -18px; opacity: 0.50; }

  /* Diamants dorés */
  .auth-diamond {
    position: absolute; width: 15px; height: 15px;
    border: 3px solid rgba(240,200,90,0.65); transform: rotate(45deg); pointer-events: none;
  }
  .auth-diamond-1 { top: 15%; right: 16%; }
  .auth-diamond-2 { top: 20%; right: 25%; width: 9px; height: 9px; opacity: 0.45; }
  .auth-diamond-3 { bottom: 22%; left: 18%; width: 11px; height: 11px; opacity: 0.4; }

  /* Tags phonèmes flottants */
  .auth-tag {
    position: absolute; background: rgba(255,255,255,0.16);
    border: 1.5px solid rgba(255,255,255,0.28); border-radius: 10px;
    padding: 5px 13px; font-weight: 900; font-size: 0.78rem; color: white;
    pointer-events: none; letter-spacing: 0.02em;
  }
  .auth-tag-1 { top: 14%; left: 14%; animation: auth-fl 2.8s ease-in-out infinite alternate; }
  .auth-tag-2 { top: 36%; right: 14%; animation: auth-fl 3.2s ease-in-out infinite alternate; animation-delay: 0.5s; }
  .auth-tag-3 { bottom: 26%; left: 16%; animation: auth-fl 2.6s ease-in-out infinite alternate; animation-delay: 1s; }

  /* Mic central */
  .auth-mic-wrap {
    position: relative; z-index: 2;
    display: flex; flex-direction: column; align-items: center; gap: 28px;
  }
  /* Halo externe pulsé */
  .auth-mic-halo {
    position: relative;
    width: 168px; height: 168px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    animation: auth-float 3.8s ease-in-out infinite;
  }
  .auth-mic-halo::before {
    content: ''; position: absolute; inset: -10px;
    border-radius: 50%; border: 1.5px solid rgba(255,255,255,0.18);
    pointer-events: none;
  }
  .auth-mic-halo::after {
    content: ''; position: absolute; inset: -22px;
    border-radius: 50%; border: 1px solid rgba(255,255,255,0.09);
    pointer-events: none;
  }
  .auth-mic-circle {
    width: 148px; height: 148px; border-radius: 50%;
    background: rgba(255,255,255,0.18);
    border: 2px solid rgba(255,255,255,0.32);
    display: flex; align-items: center; justify-content: center;
    box-shadow:
      0 20px 60px rgba(0,0,0,0.12),
      inset 0 1px 0 rgba(255,255,255,0.35);
  }
  .auth-mic-inner {
    width: 96px; height: 96px; border-radius: 50%;
    background: linear-gradient(145deg, #ffffff 0%, #f0fafa 100%);
    display: flex; align-items: center; justify-content: center;
    box-shadow:
      0 6px 20px rgba(0,0,0,0.10),
      0 2px 6px rgba(0,0,0,0.06),
      inset 0 1px 0 rgba(255,255,255,0.9);
  }

  /* Waveform */
  .auth-wave { display: flex; align-items: center; gap: 4px; height: 40px; }
  .auth-wave-bar {
    width: 4px; border-radius: 3px;
    animation: auth-wave-anim 0.9s ease-in-out infinite;
  }
  .auth-wave-bar:nth-child(3n+1) { background: rgba(255,255,255,0.88); }
  .auth-wave-bar:nth-child(3n+2) { background: rgba(232,71,106,0.75); }
  .auth-wave-bar:nth-child(3n)   { background: rgba(240,200,90,0.72); }

  /* Tagline + badge */
  .auth-tagline {
    font-family: 'Nunito', sans-serif; font-weight: 700; font-size: 14px;
    color: rgba(255,255,255,0.75); text-align: center;
    max-width: 210px; line-height: 1.6; position: relative; z-index: 2;
  }
  .auth-tagline strong { color: white; font-weight: 900; }

  .auth-badge {
    display: inline-flex; align-items: center; gap: 7px;
    background: rgba(255,255,255,0.13); border: 1.5px solid rgba(255,255,255,0.22);
    border-radius: 999px; padding: 5px 15px;
    font-size: 0.62rem; font-weight: 800; color: rgba(255,255,255,0.9);
    letter-spacing: 0.12em; text-transform: uppercase;
    position: relative; z-index: 2; margin-top: 4px;
  }
  .auth-badge-dot { width: 6px; height: 6px; border-radius: 50%; background: ${C.gold}; flex-shrink: 0; animation: auth-blink 1.6s ease-in-out infinite; }

  /* Logo bas */
  .auth-left-logo {
    position: absolute; bottom: 28px; left: 50%; transform: translateX(-50%);
    display: flex; align-items: center; gap: 9px; text-decoration: none; z-index: 2;
    white-space: nowrap;
  }
  .auth-left-logo-icon { width: 32px; height: 32px; border-radius: 9px; background: rgba(255,255,255,0.18); border: 1.5px solid rgba(255,255,255,0.3); display: flex; align-items: center; justify-content: center; }
  .auth-left-logo-name { font-family: 'Nunito', sans-serif; font-weight: 900; font-size: 18px; color: white; }
  .auth-left-logo-name span { color: rgba(255,255,255,0.6); }

  /* ══════════════════════════════
     RIGHT PANEL
  ══════════════════════════════ */
  .auth-right {
    flex: 1; display: flex; align-items: center; justify-content: center;
    padding: 48px 32px; background: ${C.bg}; overflow-y: auto;
  }
  .auth-form-wrap { width: 100%; max-width: 415px; animation: auth-fade-up 0.45s ease-out; }

  /* Mobile logo */
  .auth-mobile-logo { display: flex; align-items: center; gap: 10px; margin-bottom: 28px; text-decoration: none; }
  @media (min-width: 1024px) { .auth-mobile-logo { display: none; } }
  .auth-mobile-icon { width: 36px; height: 36px; border-radius: 10px; background: ${C.teal}; display: flex; align-items: center; justify-content: center; box-shadow: 0 3px 10px rgba(128,220,220,0.28); }
  .auth-mobile-name { font-family: 'Nunito', sans-serif; font-weight: 900; font-size: 20px; color: ${C.dark}; }
  .auth-mobile-name span { color: ${C.pink}; }

  /* Card */
  .auth-card {
    background: ${C.white}; border-radius: 26px; padding: 40px 38px;
    box-shadow: 0 4px 28px rgba(28,43,58,0.07), 0 1px 4px rgba(28,43,58,0.03);
    border: 1.5px solid ${C.border};
  }

  /* Titre + sous-titre */
  .auth-title {
    font-family: 'Nunito', sans-serif; font-weight: 900; font-size: 27px;
    color: ${C.dark}; margin-bottom: 5px; letter-spacing: -0.02em;
  }
  .auth-subtitle {
    font-size: 13.5px; color: ${C.mid}; font-weight: 500;
    margin-bottom: 26px; line-height: 1.6;
  }

  /* Tabs */
  .auth-tabs {
    display: flex; gap: 4px; background: ${C.bg};
    border-radius: 13px; padding: 4px; margin-bottom: 22px;
    border: 1.5px solid ${C.border};
  }
  .auth-tab {
    flex: 1; padding: 10px; border-radius: 10px; border: none; cursor: pointer;
    font-family: 'Nunito', sans-serif; font-weight: 800; font-size: 12.5px;
    text-transform: uppercase; letter-spacing: 0.07em; transition: all 0.2s;
    background: transparent; color: ${C.muted};
  }
  .auth-tab.active {
    background: white; color: ${C.teal};
    box-shadow: 0 2px 8px rgba(28,43,58,0.06);
    border-bottom: 2.5px solid ${C.teal};
  }
  .auth-tab:hover:not(.active) { color: ${C.mid}; background: rgba(255,255,255,0.55); }

  /* Error */
  .auth-error {
    background: #FEF0EE; border: 1.5px solid #F5C6C2; color: #A83228;
    border-radius: 11px; padding: 10px 14px; font-size: 12.5px; font-weight: 700;
    margin-bottom: 16px; display: flex; align-items: center; gap: 8px;
  }

  /* Form */
  .auth-form { display: flex; flex-direction: column; gap: 13px; }
  .auth-row  { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .auth-field { display: flex; flex-direction: column; gap: 5px; }
  .auth-label {
    font-size: 10.5px; font-weight: 800; color: ${C.muted};
    text-transform: uppercase; letter-spacing: 0.12em; margin-left: 2px;
  }
  .auth-input {
    width: 100%; padding: 12px 14px; border-radius: 11px;
    border: 1.5px solid ${C.border}; background: ${C.bg}; outline: none;
    font-family: 'Plus Jakarta Sans', sans-serif; font-size: 13.5px; font-weight: 500; color: ${C.dark};
    transition: all 0.18s;
  }
  .auth-input:focus { border-color: ${C.teal}; background: white; box-shadow: 0 0 0 3.5px rgba(128,220,220,0.10); }
  .auth-input::placeholder { color: #C8D4DD; font-weight: 400; }
  .auth-input-wrap { position: relative; }
  .auth-eye {
    position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
    background: none; border: none; cursor: pointer; color: ${C.muted};
    display: flex; align-items: center; padding: 3px; transition: color 0.18s;
  }
  .auth-eye:hover { color: ${C.teal}; }
  .auth-select {
    width: 100%; padding: 12px 14px; border-radius: 11px;
    border: 1.5px solid ${C.border}; background: ${C.bg}; outline: none;
    font-family: 'Plus Jakarta Sans', sans-serif; font-size: 13.5px; font-weight: 500; color: ${C.dark};
    cursor: pointer; appearance: none; transition: all 0.18s;
  }
  .auth-select:focus { border-color: ${C.teal}; background: white; box-shadow: 0 0 0 3.5px rgba(128,220,220,0.10); }

  /* Bouton principal — ROSE */
  .auth-btn {
    width: 100%; padding: 14px; border-radius: 12px;
    border: none; border-bottom: 3px solid ${C.pinkDark}; cursor: pointer;
    font-family: 'Nunito', sans-serif; font-weight: 900; font-size: 14.5px; color: white;
    background: ${C.pink};
    box-shadow: 0 4px 18px rgba(232,71,106,0.25); transition: all 0.22s;
    display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 4px;
  }
  .auth-btn:hover:not(:disabled) { background: ${C.pinkDark}; transform: translateY(-2px); box-shadow: 0 8px 26px rgba(232,71,106,0.36); }
  .auth-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

  /* Switch + back */
  .auth-switch { margin-top: 18px; text-align: center; font-size: 13px; color: ${C.muted}; font-weight: 500; }
  .auth-switch-btn {
    background: none; border: none; cursor: pointer;
    font-weight: 800; font-family: 'Nunito', sans-serif; font-size: 13px; padding: 0;
    color: ${C.teal}; transition: color 0.18s;
  }
  .auth-switch-btn:hover { color: ${C.tealDark}; text-decoration: underline; }
  .auth-back {
    display: block; text-align: center; margin-top: 16px;
    font-size: 12.5px; color: ${C.muted}; text-decoration: none;
    font-weight: 500; transition: color 0.18s;
  }
  .auth-back:hover { color: ${C.teal}; }

  /* Divider */
  .auth-divider {
    display: flex; align-items: center; gap: 12px;
    margin: 6px 0 2px; color: ${C.muted}; font-size: 11.5px; font-weight: 600;
  }
  .auth-divider::before, .auth-divider::after {
    content: ''; flex: 1; height: 1px; background: ${C.border};
  }

  /* Trust row */
  .auth-trust {
    display: flex; align-items: center; justify-content: center; gap: 14px;
    margin-top: 20px; padding-top: 18px; border-top: 1px solid ${C.border};
  }
  .auth-trust-avatars { display: flex; }
  .auth-trust-avatar {
    width: 26px; height: 26px; border-radius: 50%;
    border: 2px solid white; margin-left: -7px; font-size: 0.55rem;
    font-weight: 900; color: white; display: flex; align-items: center; justify-content: center;
  }
  .auth-trust-text { font-size: 11.5px; color: ${C.muted}; font-weight: 600; line-height: 1.4; }
  .auth-trust-stars { display: flex; gap: 1px; }
  .auth-trust-star  { font-size: 0.68rem; color: ${C.gold}; }

  /* Animations */
  @keyframes auth-float    { 0%,100%{transform:translateY(0)}   50%{transform:translateY(-10px)} }
  @keyframes auth-fl       { 0%{transform:translateY(0)}        100%{transform:translateY(-8px)} }
  @keyframes auth-fade-up  { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
  @keyframes auth-wave-anim{ 0%,100%{transform:scaleY(0.3)}     50%{transform:scaleY(1)} }
  @keyframes auth-spin     { from{transform:rotate(0deg)}        to{transform:rotate(360deg)} }
  @keyframes auth-blink    { 0%,100%{opacity:1}                  50%{opacity:0.4} }
  .auth-spin { animation: auth-spin 0.85s linear infinite; }
`;

const WAVE_H = [10, 20, 32, 42, 34, 26, 40, 34, 22, 42, 32, 20, 30, 16, 26, 12];
const TRUST_COLORS = [C.teal, C.coral, C.violet, C.gold, C.pink];
const TRUST_LABELS = ['A', 'K', 'S', 'L', 'M'];

/* ── Validation helpers ─────────────────────────────────────────────── */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function getPasswordStrength(pw) {
  if (!pw) return { score: 0, label: '', color: 'transparent' };
  let score = 0;
  if (pw.length >= 8)              score++;
  if (/[A-Z]/.test(pw))           score++;
  if (/[0-9]/.test(pw))           score++;
  if (/[^A-Za-z0-9]/.test(pw))    score++;
  const labels = { fr: ['','Faible','Moyen','Bon','Fort'], en: ['','Weak','Fair','Good','Strong'] };
  const colors = ['transparent', C.pink, C.coral, C.gold, C.tealDark];
  return { score, labels, color: colors[score] };
}

function PasswordCriteria({ pw, lang }) {
  const isFr = lang !== 'en';
  const criteria = [
    { ok: pw.length >= 8,            fr: '8 caractères minimum',     en: '8 characters minimum'     },
    { ok: /[A-Z]/.test(pw),         fr: '1 majuscule',               en: '1 uppercase letter'        },
    { ok: /[0-9]/.test(pw),         fr: '1 chiffre',                 en: '1 number'                  },
    { ok: /[^A-Za-z0-9]/.test(pw),  fr: '1 caractère spécial (!@#…)','en':'1 special character (!@#…)' },
  ];
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:4, marginTop:6 }}>
      {criteria.map((c, i) => (
        <div key={i} style={{ display:'flex', alignItems:'center', gap:7, fontSize:11, fontWeight:600 }}>
          <span style={{
            width:14, height:14, borderRadius:'50%', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:9, flexShrink:0,
            background: c.ok ? C.tealDark : '#E8E4DF', color: c.ok ? 'white' : C.muted,
            transition:'all .2s',
          }}>{c.ok ? '✓' : '·'}</span>
          <span style={{ color: c.ok ? C.tealDeep : C.muted, transition:'color .2s' }}>
            {isFr ? c.fr : c.en}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function Login() {
  const { lang } = useLanguage();
  const tl = TL[lang] || TL.fr;
  const isFr = lang !== 'en';

  const [phase,        setPhase]        = useState('login');
  const [isLogin,      setIsLogin]      = useState(true);
  const [showPw,       setShowPw]       = useState(false);
  const [showConfirmPw,setShowConfirmPw]= useState(false);
  const [error,        setError]        = useState('');
  const [fieldErrors,  setFieldErrors]  = useState({});
  const [forgotEmail,  setForgotEmail]  = useState('');
  const [forgotLoading,setForgotLoading]= useState(false);
  const [forgotError,  setForgotError]  = useState('');
  const [showCriteria, setShowCriteria] = useState(false);
  const { login, register, loading } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: '', password: '', confirmPassword: '',
    firstName: '', lastName: '',
  });

  const set = (key) => (e) => {
    const value = e.target.value;
    setForm(prev => ({ ...prev, [key]: value }));
    // Clear field error on typing
    if (fieldErrors[key]) setFieldErrors(prev => ({ ...prev, [key]: '' }));
  };

  const goForgot = () => { setPhase('forgot'); setError(''); setForgotError(''); setForgotEmail(form.email || ''); };
  const goLogin  = () => { setPhase('login'); setForgotError(''); };
  const switchMode = () => { setIsLogin(v => !v); setError(''); setFieldErrors({}); setShowCriteria(false); };

  /* ── Validate forgot email ──────────────────────────────────────── */
  const handleForgot = async (e) => {
    e.preventDefault();
    setForgotError('');
    const email = forgotEmail.trim().toLowerCase();
    if (!email) { setForgotError(isFr ? 'Veuillez saisir votre email.' : 'Please enter your email.'); return; }
    if (!EMAIL_RE.test(email)) { setForgotError(isFr ? 'Format d\'email invalide.' : 'Invalid email format.'); return; }
    setForgotLoading(true);
    try {
      await forgotPassword(email);
      setPhase('sent');
    } catch (err) {
      const status = err?.response?.status;
      const code   = err?.response?.data?.code;
      if (code === 'SMTP_NOT_CONFIGURED' || status === 503) {
        setForgotError(isFr
          ? "Fonctionnalité email non encore activée. Contacte l'administrateur."
          : "Email feature not yet activated. Contact the administrator.");
      } else if (status === 502) {
        setForgotError(isFr
          ? "L'envoi de l'email a échoué. Vérifie que le mot de passe email est correct dans les paramètres admin."
          : "Email sending failed. Check that the email password is correct in admin settings.");
      } else {
        setPhase('sent'); // Ne pas révéler si l'email existe
      }
    } finally {
      setForgotLoading(false);
    }
  };

  /* ── Map HTTP errors → user-friendly messages ───────────────────── */
  const mapError = (err) => {
    const status = err?.response?.status;
    const serverMsg = err?.response?.data?.message || err?.response?.data?.error_description;
    if (status === 401) return isFr ? 'Email ou mot de passe incorrect.' : 'Incorrect email or password.';
    if (status === 409) return isFr ? 'Cette adresse email est déjà utilisée.' : 'This email address is already taken.';
    if (status === 429) return isFr ? 'Trop de tentatives. Réessayez dans quelques minutes.' : 'Too many attempts. Please wait a few minutes.';
    if (status === 502 || status === 503) return isFr ? 'Service temporairement indisponible. Réessayez.' : 'Service temporarily unavailable. Please retry.';
    if (serverMsg) return serverMsg;
    return tl.error_default;
  };

  /* ── Validate form before submit ────────────────────────────────── */
  const validateForm = () => {
    const errors = {};
    const { email, password, confirmPassword, firstName, lastName } = form;

    if (!email.trim()) {
      errors.email = isFr ? 'Email requis.' : 'Email required.';
    } else if (!EMAIL_RE.test(email.trim())) {
      errors.email = isFr ? 'Format d\'email invalide (ex: nom@domaine.com).' : 'Invalid email format (e.g. name@domain.com).';
    }

    if (!password) {
      errors.password = isFr ? 'Mot de passe requis.' : 'Password required.';
    } else if (!isLogin) {
      const { score } = getPasswordStrength(password);
      if (score < 4) {
        errors.password = isFr
          ? 'Le mot de passe ne respecte pas tous les critères.'
          : 'Password does not meet all criteria.';
      }
    }

    if (!isLogin) {
      if (!firstName.trim() || firstName.trim().length < 2) {
        errors.firstName = isFr ? 'Prénom requis (min 2 caractères).' : 'First name required (min 2 chars).';
      }
      if (!lastName.trim() || lastName.trim().length < 2) {
        errors.lastName = isFr ? 'Nom requis (min 2 caractères).' : 'Last name required (min 2 chars).';
      }
      if (!confirmPassword) {
        errors.confirmPassword = isFr ? 'Confirmez votre mot de passe.' : 'Please confirm your password.';
      } else if (confirmPassword !== password) {
        errors.confirmPassword = isFr ? 'Les mots de passe ne correspondent pas.' : 'Passwords do not match.';
      }
    }

    return errors;
  };

  /* ── Submit ─────────────────────────────────────────────────────── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const errors = validateForm();
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }
    setFieldErrors({});
    try {
      const result = await (isLogin
        ? login(form.email.trim(), form.password)
        : register({
            email:    form.email.trim(),
            password: form.password,
            fullName: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
          }));
      const isCefrDone = result?.cefrCompleted || result?.cefr_completed;
      navigate(isCefrDone ? '/dashboard' : '/cefr-test');
    } catch (err) {
      setError(mapError(err));
    }
  };

  const pwStrength = !isLogin ? getPasswordStrength(form.password) : null;

  return (
    <div className="auth-root">
      <style>{styles}</style>

      {/* ── LEFT PANEL — teal gradient ── */}
      <div className="auth-left">

        {/* Blobs */}
        <div className="auth-blob auth-blob-1" />
        <div className="auth-blob auth-blob-2" />
        <div className="auth-blob auth-blob-3" />

        {/* Anneaux roses style Ascent */}
        <div className="auth-ring auth-ring-1" />
        <div className="auth-ring auth-ring-2" />
        <div className="auth-ring auth-ring-3" />
        <div className="auth-ring auth-ring-4" />

        {/* Diamants dorés */}
        <div className="auth-diamond auth-diamond-1" />
        <div className="auth-diamond auth-diamond-2" />
        <div className="auth-diamond auth-diamond-3" />

        {/* Tags phonèmes flottants */}
        <div className="auth-tag auth-tag-1">[a]</div>
        <div className="auth-tag auth-tag-2">[ɛ]</div>
        <div className="auth-tag auth-tag-3">[ʒ]</div>

        {/* Mic + wave + texte */}
        <div className="auth-mic-wrap">
          <div className="auth-mic-halo">
            <div className="auth-mic-circle">
              <div className="auth-mic-inner">
                <Mic size={40} color="#2E9898" strokeWidth={1.6} />
              </div>
            </div>
          </div>

          <div className="auth-wave">
            {WAVE_H.map((h, i) => (
              <div key={i} className="auth-wave-bar"
                style={{ height: `${h}px`, animationDelay: `${i * 0.06}s` }} />
            ))}
          </div>

          <p className="auth-tagline">
            <strong>{tl.tagline}</strong><br />{tl.tagline2}
          </p>

          <div className="auth-badge">
            <span className="auth-badge-dot" />
            {tl.badge}
          </div>
        </div>

        {/* Logo bas */}
        <Link to="/" className="auth-left-logo">
          <div className="auth-left-logo-icon">
            <Mic size={15} color="rgba(255,255,255,0.9)" />
          </div>
          <span className="auth-left-logo-name">Speak<span>Coach</span></span>
        </Link>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="auth-right">
        <div className="auth-form-wrap">

          {/* Mobile logo */}
          <Link to="/" className="auth-mobile-logo">
            <div className="auth-mobile-icon"><Mic size={17} color="white" /></div>
            <span className="auth-mobile-name">Speak<span>Coach</span></span>
          </Link>

          <div className="auth-card">

            {/* ══ PHASE : FORGOT PASSWORD ══ */}
            {phase === 'forgot' && (
              <>
                <h1 className="auth-title">{tl.fp_title}</h1>
                <p className="auth-subtitle">{tl.fp_sub}</p>

                {forgotError && (
                  <div className="auth-error">
                    <span style={{ width:7, height:7, borderRadius:'50%', background:'#C85A52', flexShrink:0 }} />
                    {forgotError}
                  </div>
                )}

                <form onSubmit={handleForgot} className="auth-form">
                  <div className="auth-field">
                    <label className="auth-label">{tl.fp_label}</label>
                    <input className="auth-input" type="email" placeholder={tl.ph_email}
                      value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} required />
                  </div>
                  <button type="submit" disabled={forgotLoading} className="auth-btn">
                    {forgotLoading
                      ? <Loader2 size={17} className="auth-spin" />
                      : <Mail size={17} />}
                    {forgotLoading ? tl.fp_sending : tl.fp_btn}
                  </button>
                </form>

                <p style={{ textAlign:'center', marginTop:18 }}>
                  <button onClick={goLogin} className="auth-switch-btn">{tl.fp_back}</button>
                </p>
              </>
            )}

            {/* ══ PHASE : EMAIL SENT ══ */}
            {phase === 'sent' && (
              <div style={{ textAlign:'center', padding:'8px 0 4px' }}>
                <div style={{ width:76, height:76, borderRadius:'50%', background:C.tealSoft, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px', border:`2px solid ${C.teal}40`, boxShadow:`0 8px 24px ${C.teal}20` }}>
                  <CheckCircle size={36} color={C.teal} strokeWidth={1.6} />
                </div>
                <h1 className="auth-title" style={{ marginBottom:8 }}>{tl.fp_sent_title}</h1>
                <p className="auth-subtitle" style={{ marginBottom:28 }}>{tl.fp_sent_sub}</p>
                <button onClick={goLogin} className="auth-btn" style={{ maxWidth:260, margin:'0 auto' }}>
                  <ArrowRight size={17} />{tl.fp_sent_btn}
                </button>
              </div>
            )}

            {/* ══ PHASE : LOGIN / SIGNUP ══ */}
            {phase === 'login' && (
              <>
                <h1 className="auth-title">
                  {isLogin ? tl.title_login : tl.title_signup}
                </h1>
                <p className="auth-subtitle">
                  {isLogin ? tl.sub_login : tl.sub_signup}
                </p>

                {/* Tabs */}
                <div className="auth-tabs">
                  <button onClick={() => { setIsLogin(true);  setError(''); setFieldErrors({}); }} className={`auth-tab ${isLogin ? 'active' : ''}`}>
                    {tl.tab_login}
                  </button>
                  <button onClick={() => { setIsLogin(false); setError(''); setFieldErrors({}); }} className={`auth-tab ${!isLogin ? 'active' : ''}`}>
                    {tl.tab_signup}
                  </button>
                </div>

                {/* Erreur globale */}
                {error && (
                  <div className="auth-error">
                    <span style={{ width:7, height:7, borderRadius:'50%', background:'#C85A52', flexShrink:0 }} />
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="auth-form" noValidate>

                  {/* ── Prénom / Nom (inscription) ── */}
                  {!isLogin && (
                    <div className="auth-row">
                      <div className="auth-field">
                        <label className="auth-label">{tl.label_first}</label>
                        <input
                          className="auth-input"
                          placeholder={tl.ph_first}
                          value={form.firstName}
                          onChange={set('firstName')}
                          style={{ borderColor: fieldErrors.firstName ? '#E8476A' : undefined }}
                        />
                        {fieldErrors.firstName && (
                          <span style={{ fontSize:10.5, color:'#E8476A', fontWeight:700, marginTop:3 }}>
                            ⚠ {fieldErrors.firstName}
                          </span>
                        )}
                      </div>
                      <div className="auth-field">
                        <label className="auth-label">{tl.label_last}</label>
                        <input
                          className="auth-input"
                          placeholder={tl.ph_last}
                          value={form.lastName}
                          onChange={set('lastName')}
                          style={{ borderColor: fieldErrors.lastName ? '#E8476A' : undefined }}
                        />
                        {fieldErrors.lastName && (
                          <span style={{ fontSize:10.5, color:'#E8476A', fontWeight:700, marginTop:3 }}>
                            ⚠ {fieldErrors.lastName}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── Email ── */}
                  <div className="auth-field">
                    <label className="auth-label">{tl.label_email}</label>
                    <input
                      className="auth-input"
                      type="email"
                      placeholder={tl.ph_email}
                      value={form.email}
                      onChange={set('email')}
                      autoComplete="username"
                      style={{ borderColor: fieldErrors.email ? '#E8476A' : undefined }}
                    />
                    {fieldErrors.email && (
                      <span style={{ fontSize:10.5, color:'#E8476A', fontWeight:700, marginTop:3 }}>
                        ⚠ {fieldErrors.email}
                      </span>
                    )}
                  </div>

                  {/* ── Mot de passe ── */}
                  <div className="auth-field">
                    <label className="auth-label">{tl.label_pw}</label>
                    <div className="auth-input-wrap">
                      <input
                        className="auth-input"
                        type={showPw ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={form.password}
                        onChange={set('password')}
                        onFocus={() => !isLogin && setShowCriteria(true)}
                        style={{ paddingRight:'42px', borderColor: fieldErrors.password ? '#E8476A' : undefined }}
                        autoComplete={isLogin ? 'current-password' : 'new-password'}
                      />
                      <button type="button" onClick={() => setShowPw(v => !v)} className="auth-eye">
                        {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>

                    {/* Indicateur de force (inscription) */}
                    {!isLogin && form.password && (
                      <>
                        <div style={{ display:'flex', gap:4, marginTop:7 }}>
                          {[1,2,3,4].map(i => (
                            <div key={i} style={{
                              flex:1, height:4, borderRadius:99,
                              background: i <= pwStrength.score ? pwStrength.color : '#E8E4DF',
                              transition: 'background .25s',
                            }} />
                          ))}
                          <span style={{ fontSize:10, fontWeight:800, color: pwStrength.color, marginLeft:6, whiteSpace:'nowrap', alignSelf:'center' }}>
                            {pwStrength.labels[isFr ? 'fr' : 'en'][pwStrength.score]}
                          </span>
                        </div>
                        <PasswordCriteria pw={form.password} lang={lang} />
                      </>
                    )}

                    {fieldErrors.password && (
                      <span style={{ fontSize:10.5, color:'#E8476A', fontWeight:700, marginTop:3, display:'block' }}>
                        ⚠ {fieldErrors.password}
                      </span>
                    )}

                    {/* Mot de passe oublié (connexion) */}
                    {isLogin && (
                      <button type="button" onClick={goForgot}
                        style={{ background:'none', border:'none', cursor:'pointer', fontSize:'11.5px', fontWeight:700, color:C.teal, padding:'4px 0 0', textAlign:'right', width:'100%', transition:'color .15s' }}
                        onMouseEnter={e => e.currentTarget.style.color=C.tealDark}
                        onMouseLeave={e => e.currentTarget.style.color=C.teal}>
                        {tl.fp_link}
                      </button>
                    )}
                  </div>

                  {/* ── Confirmer le mot de passe (inscription) ── */}
                  {!isLogin && (
                    <div className="auth-field">
                      <label className="auth-label">
                        {isFr ? 'Confirmer le mot de passe' : 'Confirm password'}
                      </label>
                      <div className="auth-input-wrap">
                        <input
                          className="auth-input"
                          type={showConfirmPw ? 'text' : 'password'}
                          placeholder="••••••••"
                          value={form.confirmPassword}
                          onChange={set('confirmPassword')}
                          style={{ paddingRight:'42px', borderColor: fieldErrors.confirmPassword ? '#E8476A' : (form.confirmPassword && form.confirmPassword === form.password ? C.tealDark : undefined) }}
                          autoComplete="new-password"
                        />
                        <button type="button" onClick={() => setShowConfirmPw(v => !v)} className="auth-eye">
                          {showConfirmPw ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {/* Match indicator */}
                      {form.confirmPassword && !fieldErrors.confirmPassword && (
                        <span style={{ fontSize:10.5, fontWeight:700, marginTop:3, display:'block',
                          color: form.confirmPassword === form.password ? C.tealDeep : '#E8476A' }}>
                          {form.confirmPassword === form.password
                            ? (isFr ? '✓ Les mots de passe correspondent' : '✓ Passwords match')
                            : (isFr ? '✗ Ne correspond pas' : '✗ Does not match')}
                        </span>
                      )}
                      {fieldErrors.confirmPassword && (
                        <span style={{ fontSize:10.5, color:'#E8476A', fontWeight:700, marginTop:3, display:'block' }}>
                          ⚠ {fieldErrors.confirmPassword}
                        </span>
                      )}
                    </div>
                  )}

                  <button type="submit" disabled={loading} className="auth-btn">
                    {loading
                      ? <div style={{ width:17, height:17, border:'3px solid rgba(255,255,255,0.3)', borderTopColor:'white', borderRadius:'50%' }} className="auth-spin" />
                      : <ArrowRight size={17} />}
                    {isLogin ? tl.btn_login : tl.btn_signup}
                  </button>
                </form>

                <p className="auth-switch">
                  {isLogin ? tl.switch_login : tl.switch_signup}
                  <button onClick={switchMode} className="auth-switch-btn">
                    {isLogin ? tl.switch_btn_login : tl.switch_btn_signup}
                  </button>
                </p>

                {/* Trust row */}
                <div className="auth-trust">
                  <div className="auth-trust-avatars">
                    {TRUST_LABELS.map((l, i) => (
                      <div key={i} className="auth-trust-avatar"
                        style={{ background:TRUST_COLORS[i], marginLeft:i?-7:0 }}>{l}</div>
                    ))}
                  </div>
                  <div>
                    <div className="auth-trust-stars">
                      {[1,2,3,4,5].map(i => <span key={i} className="auth-trust-star">★</span>)}
                    </div>
                    <p className="auth-trust-text">{tl.trust}</p>
                  </div>
                </div>
              </>
            )}

          </div>

          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:4 }}>
            <Link to="/" className="auth-back">{tl.back}</Link>
            <Link
              to="/admin/login"
              style={{ fontSize:'11px', fontWeight:700, color:'#9BB0C2', textDecoration:'none', display:'flex', alignItems:'center', gap:4, transition:'color .15s' }}
              onMouseEnter={e => e.currentTarget.style.color='#5F7183'}
              onMouseLeave={e => e.currentTarget.style.color='#9BB0C2'}
            >
              🛡️ Admin
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
