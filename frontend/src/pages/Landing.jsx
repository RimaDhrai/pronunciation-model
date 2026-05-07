/**
 * Landing.jsx — SpeakCoach · Bilingue FR / EN
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Mic, ArrowRight, Brain, BarChart3, Zap, Star } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import api from '../api/axios';

const C = {
  bg:         '#FEF8F3',
  white:      '#FFFFFF',
  teal:       '#80DCDC',
  tealDark:   '#4DBFBF',
  tealSoft:   '#E8F9F9',
  coral:      '#E8926A',
  coralDark:  '#D47A52',
  violet:     '#9580D4',
  violetSoft: '#F3F0FE',
  blue:       '#6BACD4',
  gold:       '#F0C85A',
  pink:       '#E8476A',
  dark:       '#1C2B3A',
  mid:        '#5F7183',
  muted:      '#9BB0C2',
  border:     '#EEE8E0',
};

const T = {
  fr: {
    badge:         'Bienvenue sur SpeakCoach',
    headline1:     'Là où apprendre',
    headline2:     'devient',
    headlineEnd:   ' une aventure',
    sub:           'Coach vocal intelligent · Évaluation du niveau · Exercices personnalisés',
    cta:           'Commencer gratuitement',
    score_label:   'Score de prononciation',
    features_title:'Ce que vous obtenez',
    features:      ['Test de niveau', 'Exercices A1 → C2', 'Suivi en temps réel', 'Feedback instantané'],
    statLabels:    ['Apprenants', 'Niveaux', 'Langues', 'Satisfaction'],
    cta2_title:    'Prêt à parler comme un natif ?',
    cta2_btn:      'Commencer maintenant',
    login:         'Connexion',
    start:         'Commencer →',
    footer:        '© 2025 SpeakCoach · Données 100% locales',
  },
  en: {
    badge:         'Welcome to SpeakCoach',
    headline1:     'Where learning',
    headline2:     'becomes',
    headlineEnd:   ' an adventure',
    sub:           'Smart voice coaching · Level assessment · Personalized exercises',
    cta:           'Start for free',
    score_label:   'Pronunciation score',
    features_title:'What you get',
    features:      ['Level test', 'Exercises A1 → C2', 'Real-time tracking', 'Instant feedback'],
    statLabels:    ['Learners', 'Levels', 'Languages', 'Satisfaction'],
    cta2_title:    'Ready to speak like a native?',
    cta2_btn:      'Start now',
    login:         'Login',
    start:         'Get Started →',
    footer:        '© 2025 SpeakCoach · 100% local data',
  },
};

const STATS_VALS = ['+200', '6', '2', '98%'];
const STAT_COLORS = [
  { color: C.coral,  bg: '#FEF3EC'    },
  { color: C.teal,   bg: C.tealSoft   },
  { color: C.violet, bg: C.violetSoft },
  { color: C.blue,   bg: '#EBF4FB'   },
];
const FEATURE_ICONS = [Brain, Zap, BarChart3, Star];
const FEATURE_STYLES = [
  { color: C.teal,   bg: C.tealSoft   },
  { color: C.violet, bg: C.violetSoft },
  { color: C.coral,  bg: '#FEF3EC'   },
  { color: C.blue,   bg: '#EBF4FB'   },
];

export default function Landing() {
  const { lang, setLang } = useLanguage();
  const t = T[lang] || T.fr;

  const [stats, setStats] = useState({ learners: 200, levels: 6, languages: 2, satisfaction: 98 });

  useEffect(() => {
    api.get('/api/public/stats').then(res => {
      setStats(res.data);
    }).catch(() => {});
  }, []);

  const statsValues = [
    `${stats.learners}`,
    `${stats.levels}`,
    `${stats.languages}`,
    `${stats.satisfaction}%`
  ];

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans','Nunito',system-ui,sans-serif", background: C.bg, color: C.dark, minHeight: '100vh', overflowX: 'hidden' }}>

      {/* ── NAV ── */}
      <nav style={{ background: C.white, borderBottom: `1px solid ${C.border}`, padding: '0 clamp(20px,5vw,80px)', position: 'sticky', top: 0, zIndex: 50, boxShadow: '0 2px 12px rgba(28,43,58,0.04)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

          {/* Logo */}
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: C.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 6px 16px ${C.teal}44` }}>
              <Mic style={{ width: 16, height: 16, color: 'white' }} />
            </div>
            <span style={{ fontWeight: 900, fontSize: '1rem', color: C.dark }}>Speak<span style={{ color: C.teal }}>Coach</span></span>
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>

            {/* ── FR / EN toggle ── */}
            <div style={{ display: 'flex', gap: 3, background: C.bg, borderRadius: 10, padding: 3, border: `1.5px solid ${C.border}` }}>
              {['fr', 'en'].map(l => (
                <button key={l} onClick={() => setLang(l)}
                  style={{
                    padding: '5px 13px', borderRadius: 7, fontWeight: 800,
                    fontSize: '0.75rem', border: 'none', cursor: 'pointer',
                    background: lang === l ? C.teal : 'transparent',
                    color: lang === l ? 'white' : C.mid,
                    transition: 'all .15s',
                    boxShadow: lang === l ? `0 2px 8px ${C.teal}40` : 'none',
                  }}>
                  <img src={`https://flagcdn.com/16x12/${l === 'fr' ? 'fr' : 'gb'}.png`} width="16" height="12" alt={l.toUpperCase()} style={{ borderRadius: 2, flexShrink: 0 }} />
                  {l.toUpperCase()}
                </button>
              ))}
            </div>

            <Link className="nav-login" to="/login" style={{ width: 120, textAlign: 'center', padding: '8px 0', borderRadius: 10, fontWeight: 700, fontSize: '0.85rem', color: C.mid, textDecoration: 'none', border: `1.5px solid ${C.border}`, background: C.white, transition: 'all 0.2s' }}>{t.login}</Link>
            <Link className="nav-start" to="/login" style={{ width: 150, textAlign: 'center', padding: '8px 0', borderRadius: 10, fontWeight: 800, fontSize: '0.85rem', background: C.teal, color: 'white', textDecoration: 'none', boxShadow: `0 4px 14px ${C.teal}44`, borderBottom: `3px solid ${C.tealDark}`, transition: 'all 0.2s' }}>{t.start}</Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ padding: 'clamp(72px,10vw,120px) clamp(20px,5vw,80px)', position: 'relative', overflow: 'hidden' }}>

        <div style={{ position: 'absolute', width: 100, height: 100, borderRadius: '50%', border: `3.5px solid ${C.pink}`, opacity: 0.6, top: '10%', left: '-30px', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', width: 140, height: 140, borderRadius: '50%', border: `3.5px solid ${C.pink}`, opacity: 0.5, bottom: '8%', right: '-44px', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', width: 16, height: 16, border: `3px solid ${C.gold}`, transform: 'rotate(45deg)', opacity: 0.55, top: '18%', right: '18%', pointerEvents: 'none' }} />

        <div style={{ maxWidth: 680, margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>

          {/* Badge */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: C.tealSoft, border: `1px solid ${C.teal}30`, borderRadius: 999, padding: '6px 18px', marginBottom: 28 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.teal, animation: 'blink 1.5s infinite', display: 'inline-block' }} />
            <span style={{ fontWeight: 800, fontSize: '0.68rem', color: C.tealDark, textTransform: 'uppercase', letterSpacing: '0.14em' }}>{t.badge}</span>
          </div>

          {/* Headline */}
          <h1 style={{ fontWeight: 900, fontSize: 'clamp(2.2rem,6vw,3.8rem)', lineHeight: 1.25, color: C.dark, margin: '0 0 22px', letterSpacing: '-0.04em' }}>
            <span style={{ display: 'block', marginBottom: '0.12em' }}>{t.headline1}</span>
            <span style={{ color: C.pink }}>{t.headline2}</span>{t.headlineEnd}
          </h1>

          <p style={{ fontWeight: 500, fontSize: '1rem', color: C.mid, margin: '0 auto 40px', maxWidth: 460, lineHeight: 1.65 }}>
            {t.sub}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 56 }}>
            <Link to="/login"
              style={{ 
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 9, 
                width: '100%', maxWidth: 300, padding: '16px 0', borderRadius: 999, fontWeight: 900, 
                fontSize: '1rem', background: C.teal, color: 'white', textDecoration: 'none', 
                boxShadow: `0 8px 28px ${C.teal}50`, borderBottom: `3px solid ${C.tealDark}`,
                transition: 'transform 0.2s'
              }}
              onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              {t.cta} <ArrowRight style={{ width: 18, height: 18 }} />
            </Link>

            {/* Score card */}
            <div style={{ display: 'inline-block', background: C.white, borderRadius: 24, border: `1.5px solid ${C.border}`, borderBottom: `4px solid ${C.border}`, padding: '24px 32px', boxShadow: '0 16px 48px rgba(28,43,58,0.09)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: `linear-gradient(135deg,${C.teal},${C.tealDark})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 8px 20px ${C.teal}44` }}>
                <Mic style={{ width: 24, height: 24, color: 'white' }} />
              </div>
              <div style={{ textAlign: 'left' }}>
                <p style={{ fontWeight: 900, fontSize: '2rem', color: C.teal, margin: 0, letterSpacing: '-0.04em', lineHeight: 1 }}>87<span style={{ fontSize: '1rem', color: C.muted, fontWeight: 600 }}>/100</span></p>
                <p style={{ fontWeight: 700, fontSize: '0.65rem', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '4px 0 0' }}>{t.score_label}</p>
              </div>
              <div style={{ background: `linear-gradient(135deg,${C.coral},${C.coralDark})`, borderRadius: 12, padding: '10px 16px', boxShadow: `0 6px 16px ${C.coral}40` }}>
                <p style={{ fontWeight: 900, fontSize: '1.2rem', color: 'white', margin: 0, lineHeight: 1 }}>B2</p>
                <p style={{ fontWeight: 700, fontSize: '0.5rem', color: 'rgba(255,255,255,0.85)', margin: '3px 0 0' }}>Niveau</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', marginTop: 16, height: 24, justifyContent: 'center' }}>
              {[0.4,0.7,1,0.6,0.9,0.5,0.8,1,0.6,0.7,0.4,0.8].map((h,i) => (
                <div key={i} style={{ width: 4, borderRadius: 2, height: `${h*24}px`, background: i%2===0?C.teal:C.coral, animation: `wBar ${0.5+i*0.08}s ease-in-out infinite alternate` }} />
              ))}
            </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section style={{ background: C.white, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, padding: 'clamp(28px,3vw,44px) clamp(20px,5vw,80px)' }}>
        <div className="stats-grid" style={{ maxWidth: 800, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
          {statsValues.map((val, i) => (
            <div key={i} style={{ textAlign: 'center', padding: '1.2rem 0.8rem', borderRadius: 18, background: STAT_COLORS[i].bg }}>
              <p style={{ fontWeight: 900, fontSize: '1.8rem', color: STAT_COLORS[i].color, margin: 0, letterSpacing: '-0.04em', lineHeight: 1 }}>{val}</p>
              <p style={{ fontWeight: 600, fontSize: '0.7rem', color: C.mid, margin: '5px 0 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t.statLabels[i]}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section style={{ padding: 'clamp(48px,6vw,80px) clamp(20px,5vw,80px)' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontWeight: 800, fontSize: '0.68rem', color: C.teal, textTransform: 'uppercase', letterSpacing: '0.14em', margin: '0 0 32px' }}>{t.features_title}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
            {t.features.map((label, i) => {
              const Icon = FEATURE_ICONS[i];
              const { color, bg } = FEATURE_STYLES[i];
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, background: bg, borderRadius: 999, padding: '11px 22px', border: `1.5px solid ${color}20` }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: C.white, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 3px 8px ${color}20` }}>
                    <Icon style={{ width: 15, height: 15, color }} />
                  </div>
                  <span style={{ fontWeight: 700, fontSize: '0.88rem', color: C.dark }}>{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding: 'clamp(32px,4vw,56px) clamp(20px,5vw,80px) clamp(56px,7vw,88px)' }}>
        <div style={{ maxWidth: 560, margin: '0 auto', borderRadius: 24, background: `linear-gradient(150deg,#FEF0E0,#FDF6EF 60%,${C.tealSoft})`, border: `2px solid ${C.border}`, borderBottom: `5px solid ${C.border}`, padding: 'clamp(2rem,5vw,3.5rem)', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', width: 150, height: 150, borderRadius: '50%', border: `26px solid ${C.pink}`, opacity: 0.08, top: -60, right: -40, pointerEvents: 'none' }} />
          <div style={{ width: 60, height: 60, borderRadius: 18, background: C.white, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px', boxShadow: `0 6px 20px ${C.teal}20`, border: `1.5px solid ${C.border}` }}>
            <Mic style={{ width: 26, height: 26, color: C.teal }} />
          </div>
          <h2 style={{ fontWeight: 900, fontSize: 'clamp(1.4rem,3vw,2rem)', color: C.dark, margin: '0 0 24px', letterSpacing: '-0.03em' }}>
            {t.cta2_title}
          </h2>
          <Link to="/login"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '13px 34px', borderRadius: 999, fontWeight: 900, fontSize: '0.92rem', background: C.teal, color: 'white', textDecoration: 'none', boxShadow: `0 6px 20px ${C.teal}44`, borderBottom: `3px solid ${C.tealDark}` }}>
            {t.cta2_btn} <ArrowRight style={{ width: 16, height: 16 }} />
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: `1px solid ${C.border}`, background: C.white, padding: '20px clamp(20px,5vw,80px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: C.teal, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Mic style={{ width: 12, height: 12, color: 'white' }} />
          </div>
          <span style={{ fontWeight: 900, fontSize: '0.85rem', color: C.dark }}>Speak<span style={{ color: C.teal }}>Coach</span></span>
        </div>
        <p style={{ fontWeight: 500, fontSize: '0.68rem', color: C.muted, margin: 0 }}>{t.footer}</p>
        <Link to="/login" style={{ fontWeight: 600, fontSize: '0.68rem', color: C.muted, textDecoration: 'none' }}>{t.login}</Link>
      </footer>

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes wBar  { from{transform:scaleY(0.4)} to{transform:scaleY(1)} }
        
        @media (max-width: 640px) {
          .nav-login { display: none !important; }
          .nav-start { width: 120px !important; padding: 8px !important; font-size: 0.8rem !important; }
          .stats-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 12px !important; }
        }
      `}</style>
    </div>
  );
}
