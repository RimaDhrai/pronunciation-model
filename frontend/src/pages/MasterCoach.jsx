// src/pages/MasterCoach.jsx — Dashboard dynamique + Master Agent hub
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { getDueCount } from '../api/spacedRepetition';
import api from '../api/axios';
import {
  Trophy, Zap, Swords, BookOpen, MessageCircle,
  ChevronRight, RefreshCw, TrendingUp, Target,
  Loader2, Volume2, Brain, CheckCircle, AlertCircle,
  Flame,
} from 'lucide-react';
import { toast } from 'sonner';

/* ── Palette ──────────────────────────────────────────────────────────────── */
const C = {
  bg:      '#F5F7FF',
  white:   '#FFFFFF',
  dark:    '#1C2B3A',
  mid:     '#5F7183',
  muted:   '#9BB0C2',
  border:  '#EEE8E0',
  teal:    '#80DCDC',
  tealD:   '#2E9898',
  coral:   '#E8926A',
  violet:  '#9580D4',
  gold:    '#F0C85A',
  pink:    '#E8476A',
  blue:    '#6BACD4',
  green:   '#22C55E',
};

const LEVEL_COLORS = {
  A1: '#80DCDC', A2: '#6BACD4', B1: '#9580D4',
  B2: '#E8926A', C1: '#D46A60', C2: '#F0C85A',
};

const LEVEL_PROGRESS = { A1: 10, A2: 25, B1: 45, B2: 65, C1: 82, C2: 100 };

/* ── i18n ─────────────────────────────────────────────────────────────────── */
const T = {
  fr: {
    greeting:   (name) => `Bonjour, ${name} 👋`,
    subtitle:   "Votre centre de pilotage — l'IA orchestre votre progression",
    refresh:    'Actualiser',
    level:      'Niveau CEFR',
    xp:         'XP total',
    streak:     'Série active',
    days:       'jours',
    weakCount:  'Points faibles',
    dueCount:   'À réviser',
    recommend:  '🧠 Recommandation du coach',
    modules: {
      cefr:     { title: 'Test CEFR',         desc: 'Évaluez votre niveau de prononciation.',          action: 'Passer le test',    doneTxt: (l) => `Niveau ${l} débloqué` },
      chat:     { title: 'Coach Vocal',        desc: 'Pratiquez en conversation avec Alex l\'IA.',     action: 'Démarrer',          doneTxt: () => 'Sessions disponibles' },
      exercises:{ title: 'Exercices',          desc: 'Phrases adaptées à votre niveau CEFR.',          action: 'Pratiquer',         doneTxt: (n) => `${n} rounds effectués` },
      revision: { title: 'Révision espacée',   desc: 'Algorithme de répétition pour vos points faibles.', action: 'Réviser',       doneTxt: (n) => `${n} éléments à revoir` },
      battle:   { title: 'Battle',             desc: 'Défiez un autre apprenant.',                    action: 'Lancer une battle', doneTxt: () => 'Classement en ligne' },
    },
    weakTitle:  'Sons & mots à travailler',
    weakEmpty:  'Aucun point faible — commencez un exercice !',
    sessionErr: 'Session master introuvable — clic pour recréer.',
    initBtn:    'Créer ma session',
    recTexts: {
      noTest:   'Commencez par le Test CEFR pour calibrer votre programme.',
      hasDue:   (n) => `${n} éléments en révision espacée — profitez-en maintenant !`,
      hasWeak:  'Des points faibles détectés — la révision espacée vous attend.',
      regular:  'Continuez avec les Exercices pour consolider votre niveau.',
    },
  },
  en: {
    greeting:   (name) => `Hello, ${name} 👋`,
    subtitle:   'Your command center — AI orchestrates your progression',
    refresh:    'Refresh',
    level:      'CEFR Level',
    xp:         'Total XP',
    streak:     'Active streak',
    days:       'days',
    weakCount:  'Weak points',
    dueCount:   'Due for review',
    recommend:  '🧠 Coach recommendation',
    modules: {
      cefr:     { title: 'CEFR Test',          desc: 'Evaluate your pronunciation level.',               action: 'Take the test',    doneTxt: (l) => `Level ${l} unlocked` },
      chat:     { title: 'Vocal Coach',         desc: 'Practice in conversation with AI coach Alex.',    action: 'Start',            doneTxt: () => 'Sessions available' },
      exercises:{ title: 'Exercises',           desc: 'Phrases tailored to your CEFR level.',            action: 'Practice',         doneTxt: (n) => `${n} rounds done` },
      revision: { title: 'Spaced revision',     desc: 'Spaced repetition for your weak points.',         action: 'Review',           doneTxt: (n) => `${n} items to review` },
      battle:   { title: 'Battle',              desc: 'Challenge another learner.',                      action: 'Start battle',     doneTxt: () => 'Online ranking' },
    },
    weakTitle:  'Sounds & words to work on',
    weakEmpty:  'No weak points yet — start an exercise!',
    sessionErr: 'Master session not found — click to recreate.',
    initBtn:    'Create my session',
    recTexts: {
      noTest:   'Start with the CEFR Test to calibrate your program.',
      hasDue:   (n) => `${n} spaced repetition items due — review them now!`,
      hasWeak:  'Weak points detected — spaced revision is ready for you.',
      regular:  'Continue with Exercises to consolidate your level.',
    },
  },
};

/* ── Module card ──────────────────────────────────────────────────────────── */
function ModuleCard({ icon, title, desc, action, doneTxt, color, path, badge, badgeColor, highlight, done, navigate }) {
  return (
    <div onClick={() => navigate(path)} style={{
      background: highlight ? `linear-gradient(135deg,${color}12,${color}06)` : C.white,
      border: `1.5px solid ${highlight ? color + '80' : C.border}`,
      borderRadius: 18, padding: '18px 20px', cursor: 'pointer',
      boxShadow: highlight ? `0 6px 22px ${color}22` : '0 2px 8px rgba(0,0,0,0.04)',
      transition: 'all .18s', position: 'relative', overflow: 'hidden',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 10px 28px ${color}28`; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = highlight ? `0 6px 22px ${color}22` : '0 2px 8px rgba(0,0,0,0.04)'; }}
    >
      {highlight && (
        <div style={{ position: 'absolute', top: 10, right: 10, background: color,
          color: '#fff', fontSize: 9, fontWeight: 900, padding: '3px 9px',
          borderRadius: 99, textTransform: 'uppercase', letterSpacing: .5 }}>
          ★ Recommandé
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <div style={{ width: 42, height: 42, borderRadius: 13, flexShrink: 0,
          background: `linear-gradient(135deg,${color},${color}BB)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 4px 12px ${color}30` }}>
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ fontSize: 14, fontWeight: 900, color: C.dark, margin: 0 }}>{title}</h3>
          {badge != null && (
            <span style={{ fontSize: 10, fontWeight: 800, color: badgeColor || color,
              background: `${badgeColor || color}15`, borderRadius: 99, padding: '1px 7px',
              display: 'inline-block', marginTop: 2 }}>
              {doneTxt}
            </span>
          )}
        </div>
        {done && <CheckCircle size={16} color={C.green} style={{ flexShrink: 0 }} />}
      </div>
      <p style={{ fontSize: 12, color: C.mid, margin: '0 0 10px', lineHeight: 1.5 }}>{desc}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, color, fontSize: 12, fontWeight: 800 }}>
        {action} <ChevronRight size={13} />
      </div>
    </div>
  );
}

/* ── Progress bar ─────────────────────────────────────────────────────────── */
function ProgressBar({ label, value, max = 100, color, suffix = '%' }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.dark }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 800, color }}>{value}{suffix}</span>
      </div>
      <div style={{ height: 7, background: '#F3F4F6', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, borderRadius: 999,
          background: `linear-gradient(90deg,${color},${color}CC)`,
          transition: 'width 1s ease' }} />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
export default function MasterCoach() {
  const { lang }     = useLanguage();
  const { user, setUser } = useAuth();
  const navigate     = useNavigate();
  const t            = T[lang] || T.fr;
  const isFr         = lang !== 'en';

  const [sessionId,   setSessionId]   = useState(null);
  const [masterStats, setMasterStats] = useState(null);
  const [dueCount,    setDueCount]    = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [refreshing,  setRefreshing]  = useState(false);

  // Derived from auth + master stats
  const userLevel    = user?.cefrLevel  || user?.cefr_level  || masterStats?.cefr_level || 'B1';
  const cefrDone     = user?.cefrCompleted || user?.cefr_completed || false;
  const levelColor   = LEVEL_COLORS[userLevel] || C.violet;
  const totalXp      = (user?.totalXp || 0) + (masterStats?.total_xp || 0);
  const streak       = user?.currentStreak || 0;
  const errorLog     = masterStats?.error_log || [];
  const exRound      = masterStats?.exercise_round || 0;
  const chatRound    = masterStats?.chat_round || 0;
  const dueWords     = dueCount?.words ?? null;
  const dueSounds    = dueCount?.sounds ?? null;
  const totalDue     = (dueWords ?? 0) + (dueSounds ?? 0);

  // ── Create master session ────────────────────────────────────────────────
  const initSession = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const sid = `mc_${user?.id || 'guest'}_${Date.now()}`;
      const res = await api.post('/api/master/session', {
        session_id: sid, lang: lang || 'fr',
        level: userLevel, scenario: '',
      });
      const newSid = res.data?.session_id || sid;
      setSessionId(newSid);
      localStorage.setItem('masterSessionId', newSid);
      const statsRes = await api.get(`/api/master/session/${newSid}/stats`).catch(() => ({ data: {} }));
      setMasterStats(statsRes.data);
    } catch { setError(t.sessionErr); }
    finally { setLoading(false); }
  }, [user?.id, lang, userLevel, t.sessionErr]);

  // ── Load on mount ────────────────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem('masterSessionId');

    const loadDue = () => getDueCount().then(r => setDueCount(r.data)).catch(() => {});

    if (saved && saved.startsWith('mc_')) {
      setSessionId(saved);
      api.get(`/api/master/session/${saved}/stats`)
        .then(res => {
          if (res.data?.error === 'SESSION_NOT_FOUND') {
            localStorage.removeItem('masterSessionId');
            initSession();
          } else {
            setMasterStats(res.data); setLoading(false);
          }
        })
        .catch(() => { localStorage.removeItem('masterSessionId'); initSession(); });
    } else {
      if (saved) localStorage.removeItem('masterSessionId');
      initSession();
    }
    loadDue();
  }, []); // eslint-disable-line

  // ── Refresh all data ─────────────────────────────────────────────────────
  const refreshAll = async () => {
    setRefreshing(true);
    try {
      const promises = [
        getDueCount().then(r => setDueCount(r.data)).catch(() => {}),
        api.get('/api/user/me').then(r => setUser(prev => ({ ...prev, ...r.data }))).catch(() => {}),
      ];

      if (sessionId) {
        promises.push(api.get(`/api/master/session/${sessionId}/stats`).then(r => setMasterStats(r.data)).catch(() => {}));
      } else {
        // If no session, try to re-init
        const saved = localStorage.getItem('masterSessionId');
        if (saved) {
          promises.push(api.get(`/api/master/session/${saved}/stats`).then(res => {
            if (res.data?.error !== 'SESSION_NOT_FOUND') {
              setSessionId(saved);
              setMasterStats(res.data);
            }
          }).catch(() => {}));
        }
      }

      await Promise.all(promises);
      toast.success(isFr ? 'Données actualisées' : 'Data updated');
    } catch (err) {
      console.error('Refresh error:', err);
      toast.error(isFr ? 'Erreur de rafraîchissement' : 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  };

  // ── Recommendation ───────────────────────────────────────────────────────
  const hasNoTest = !cefrDone;
  const hasDue    = totalDue > 0;
  const hasWeak   = errorLog.length > 0;

  const recText = hasNoTest ? t.recTexts.noTest
    : hasDue  ? t.recTexts.hasDue(totalDue)
    : hasWeak ? t.recTexts.hasWeak
    : t.recTexts.regular;

  const recPath = hasNoTest ? '/cefr-test'
    : (hasDue || hasWeak) ? '/exercises/revision'
    : '/exercises';

  // ── Module cards data ────────────────────────────────────────────────────
  // IMPORTANT: spread comes first so explicit doneTxt (string) overrides the function
  const modules = [
    {
      key: 'cefr',
      ...t.modules.cefr,
      icon: <Trophy size={20} color="#fff" />,
      color: C.teal, path: '/cefr-test',
      badge: cefrDone ? userLevel : null,
      doneTxt: cefrDone ? t.modules.cefr.doneTxt(userLevel) : null,
      badgeColor: levelColor, done: cefrDone,
      highlight: hasNoTest,
    },
    {
      key: 'chat',
      ...t.modules.chat,
      icon: <MessageCircle size={20} color="#fff" />,
      color: C.violet, path: '/chatbot',
      badge: chatRound > 0 ? chatRound : true,
      doneTxt: chatRound > 0
        ? (lang === 'fr' ? `${chatRound} session${chatRound > 1 ? 's' : ''}` : `${chatRound} session${chatRound > 1 ? 's' : ''}`)
        : t.modules.chat.doneTxt(),
      badgeColor: C.violet, done: false,
      highlight: false,
    },
    {
      key: 'exercises',
      ...t.modules.exercises,
      icon: <BookOpen size={20} color="#fff" />,
      color: C.coral, path: '/exercises',
      badge: exRound > 0 ? exRound : null,
      doneTxt: t.modules.exercises.doneTxt(exRound),
      badgeColor: C.coral, done: false,
      highlight: !hasNoTest && !hasDue && !hasWeak,
    },
    {
      key: 'revision',
      ...t.modules.revision,
      icon: <Brain size={20} color="#fff" />,
      color: C.blue, path: '/exercises/revision',
      badge: totalDue > 0 ? totalDue : null,
      doneTxt: t.modules.revision.doneTxt(totalDue),
      badgeColor: totalDue > 0 ? C.pink : C.blue, done: false,
      highlight: !hasNoTest && (hasDue || hasWeak),
    },
    {
      key: 'battle',
      ...t.modules.battle,
      icon: <Swords size={20} color="#fff" />,
      color: C.violet, path: '/battle',
      badge: null, doneTxt: t.modules.battle.doneTxt(),
      badgeColor: C.violet, done: false,
      highlight: false,
    },
  ];

  if (loading) return (
    <AppLayout title="Dashboard">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: 320, flexDirection: 'column', gap: 16 }}>
        <Loader2 size={36} color={C.teal} style={{ animation: 'spin 1s linear infinite' }} />
        <p style={{ color: C.mid, fontWeight: 600, fontSize: 14 }}>
          {isFr ? 'Chargement de votre dashboard…' : 'Loading your dashboard…'}
        </p>
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    </AppLayout>
  );

  const firstName = user?.fullName?.split(' ')[0] || user?.email?.split('@')[0] || (isFr ? 'ami' : 'friend');

  return (
    <AppLayout title="Dashboard">
      <style>{`
        @keyframes spin    { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
        @keyframes glow    { 0%,100%{opacity:.5} 50%{opacity:1} }
        .mc-fade { animation: fadeUp .35s ease; }
      `}</style>

      <div className="mc-fade" style={{ maxWidth: 960, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 22 }}>

        {/* ── Error banner ─────────────────────────────────────────────── */}
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
            borderRadius: 12, background: '#FDE8EE', border: `1px solid ${C.pink}30`,
            fontSize: 13, fontWeight: 600, color: C.pink }}>
            <AlertCircle size={16} /> {error}
            <button onClick={initSession} style={{ marginLeft: 'auto', padding: '5px 14px',
              borderRadius: 8, border: `1.5px solid ${C.pink}`, background: 'transparent',
              color: C.pink, fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>
              {t.initBtn}
            </button>
          </div>
        )}

        {/* ── Hero header ──────────────────────────────────────────────── */}
        <div style={{
          background: `linear-gradient(135deg,${C.violet}18,${C.teal}12)`,
          border: `1.5px solid ${C.violet}30`,
          borderRadius: 22, padding: '24px 28px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16,
        }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 900, color: C.dark, margin: '0 0 4px' }}>
              {t.greeting(firstName)}
            </h1>
            <p style={{ fontSize: 13, color: C.mid, margin: 0 }}>{t.subtitle}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {/* CEFR badge */}
            <div style={{ textAlign: 'center', background: C.white, borderRadius: 16,
              padding: '12px 20px', border: `2px solid ${levelColor}50`, minWidth: 90 }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: levelColor }}>{userLevel}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: .5 }}>
                {t.level}
              </div>
              {!cefrDone && (
                <div style={{ fontSize: 9, fontWeight: 800, color: C.pink, marginTop: 3 }}>
                  {isFr ? 'Non évalué' : 'Not tested'}
                </div>
              )}
            </div>
            {/* XP */}
            <div style={{ textAlign: 'center', background: C.white, borderRadius: 16,
              padding: '12px 20px', border: `2px solid ${C.gold}50`, minWidth: 90 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                <Zap size={16} color={C.gold} fill={C.gold} />
                <div style={{ fontSize: 22, fontWeight: 900, color: C.gold }}>{totalXp}</div>
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: .5 }}>
                {t.xp}
              </div>
            </div>
            {/* Streak */}
            {streak > 0 && (
              <div style={{ textAlign: 'center', background: C.white, borderRadius: 16,
                padding: '12px 20px', border: `2px solid ${C.coral}50`, minWidth: 90 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                  <Flame size={16} color={C.coral} fill={C.coral} />
                  <div style={{ fontSize: 22, fontWeight: 900, color: C.coral }}>{streak}</div>
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: .5 }}>
                  {t.streak}
                </div>
              </div>
            )}
            <button 
              onClick={refreshAll} 
              disabled={refreshing} 
              className="hover:bg-slate-50 active:scale-95 transition-all"
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px',
                borderRadius: 12, border: `1.5px solid ${C.border}`, background: C.white,
                cursor: 'pointer', fontSize: 12, fontWeight: 700, color: C.mid,
              }}
            >
              <RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
              {t.refresh}
            </button>
          </div>
        </div>

        {/* ── Recommendation banner ────────────────────────────────────── */}
        <div onClick={() => navigate(recPath)} style={{
          display: 'flex', alignItems: 'center', gap: 16, padding: '16px 22px',
          borderRadius: 18, cursor: 'pointer', transition: 'all .18s',
          background: `linear-gradient(135deg,${C.violet}18,${C.teal}10)`,
          border: `1.5px solid ${C.violet}40`,
        }}
          onMouseEnter={e => e.currentTarget.style.boxShadow = `0 6px 22px ${C.violet}22`}
          onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
        >
          <div style={{ width: 46, height: 46, borderRadius: 14, flexShrink: 0,
            background: `linear-gradient(135deg,${C.violet},${C.tealD})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'glow 2.5s ease-in-out infinite' }}>
            <Brain size={22} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 900, fontSize: 14, color: C.dark, margin: '0 0 2px' }}>{t.recommend}</p>
            <p style={{ fontSize: 13, color: C.mid, margin: 0 }}>{recText}</p>
          </div>
          <ChevronRight size={20} color={C.violet} />
        </div>

        {/* ── Stats mini row ───────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12 }}>
          {[
            { icon: <Target size={14} color={C.coral} />,    label: t.weakCount,                                    value: errorLog.length, color: C.coral },
            { icon: <Brain size={14} color={C.blue} />,      label: t.dueCount,                                     value: totalDue,        color: totalDue > 0 ? C.pink : C.blue },
            { icon: <TrendingUp size={14} color={C.tealD} />,label: isFr ? 'Rounds exercices' : 'Exercise rounds',  value: exRound,         color: C.tealD },
            { icon: <MessageCircle size={14} color={C.violet} />, label: isFr ? 'Sessions chat' : 'Chat sessions', value: chatRound,       color: C.violet },
          ].map(({ icon, label, value, color }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10,
              background: C.white, border: `1.5px solid ${C.border}`,
              borderRadius: 14, padding: '12px 16px' }}>
              <div style={{ width: 34, height: 34, borderRadius: 10,
                background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {icon}
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase' }}>{label}</div>
                <div style={{ fontSize: 20, fontWeight: 900, color }}>{value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Modules grid ─────────────────────────────────────────────── */}
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 900, color: C.dark, marginBottom: 14, letterSpacing: .3 }}>
            {isFr ? "🗺️ Votre parcours" : "🗺️ Your learning path"}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 14 }}>
            {modules.map(({ key, ...m }) => (
              <ModuleCard key={key} {...m} navigate={navigate} />
            ))}
          </div>
        </div>

        {/* ── CEFR progress bar ────────────────────────────────────────── */}
        {cefrDone && (
          <div style={{ background: C.white, border: `1.5px solid ${C.border}`, borderRadius: 18, padding: '20px 22px' }}>
            <h3 style={{ fontSize: 13, fontWeight: 900, color: C.dark, marginBottom: 16 }}>
              {isFr ? '📊 Progression CEFR' : '📊 CEFR Progress'}
            </h3>
            <ProgressBar label={isFr ? `Niveau actuel : ${userLevel}` : `Current level: ${userLevel}`}
              value={LEVEL_PROGRESS[userLevel] || 45} color={levelColor} suffix="%" />
            <ProgressBar label={isFr ? 'Exercices complétés' : 'Exercises completed'}
              value={Math.min(exRound * 5, 100)} color={C.coral} suffix="%" />
            <ProgressBar label={isFr ? 'Mots maîtrisés' : 'Words mastered'}
              value={Math.max(0, 100 - Math.min(errorLog.length * 3, 100))} color={C.green} suffix="%" />
          </div>
        )}

        {/* ── Weak points ──────────────────────────────────────────────── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Volume2 size={15} color={C.coral} />
            <h2 style={{ fontSize: 14, fontWeight: 900, color: C.dark, margin: 0 }}>{t.weakTitle}</h2>
            {errorLog.length > 0 && (
              <span style={{ fontSize: 10, fontWeight: 800, background: `${C.coral}18`,
                color: C.coral, borderRadius: 99, padding: '2px 8px' }}>
                {errorLog.length}
              </span>
            )}
          </div>
          {errorLog.length === 0 ? (
            <div style={{ background: C.white, border: `1.5px dashed ${C.border}`, borderRadius: 14,
              padding: '18px', textAlign: 'center', color: C.muted, fontSize: 13, fontWeight: 600 }}>
              {t.weakEmpty}
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {errorLog.slice(0, 30).map((word, i) => (
                <span key={i} style={{ padding: '5px 13px', borderRadius: 99,
                  background: `${C.coral}12`, border: `1px solid ${C.coral}35`,
                  fontSize: 13, fontWeight: 700, color: C.coral }}>
                  {word}
                </span>
              ))}
              {errorLog.length > 30 && (
                <span style={{ padding: '5px 13px', borderRadius: 99,
                  background: '#F3F4F6', fontSize: 13, color: C.mid, fontWeight: 600 }}>
                  +{errorLog.length - 30} {isFr ? 'autres' : 'more'}
                </span>
              )}
            </div>
          )}
        </div>

      </div>
    </AppLayout>
  );
}
