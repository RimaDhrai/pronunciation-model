import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { Lock, Mic, Trophy, Flame, ArrowRight, Volume2, Brain, Zap, Star, RotateCcw } from 'lucide-react';
import { getExerciseProgress } from '../../api/exerciseProgress';
import { getDueCount } from '../../api/spacedRepetition';

const C = {
  teal:       '#80DCDC',
  tealDark:   '#4DBFBF',
  tealSoft:   '#E8F9F9',
  coral:      '#E8926A',
  coralDark:  '#D47A52',
  coralSoft:  '#FEF3EC',
  violet:     '#9580D4',
  violetSoft: '#F3F0FE',
  blue:       '#6BACD4',
  blueSoft:   '#EBF4FB',
  gold:       '#F0C85A',
  goldSoft:   '#FEF9E7',
  pink:       '#E8476A',
  pinkSoft:   '#FDEEF2',
  dark:       '#1C2B3A',
  mid:        '#5F7183',
  muted:      '#9BB0C2',
  border:     '#EEE8E0',
  white:      '#FFFFFF',
};

const LEVELS_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const LEVEL_CONFIG = {
  fr: {
    A1: { color: C.teal,   soft: C.tealSoft,   icon: Mic,     label: 'Débutant',       sub: 'Voyelles & salutations',      skills: ['Voyelles', 'Mots simples', 'Salutations'] },
    A2: { color: C.blue,   soft: C.blueSoft,   icon: Volume2, label: 'Élémentaire',    sub: 'Liaisons & expressions',      skills: ['Liaisons', 'Nasales', 'Rythme'] },
    B1: { color: C.violet, soft: C.violetSoft, icon: Brain,   label: 'Intermédiaire',  sub: 'Fluidité & phonèmes avancés', skills: ['Son [R]', 'Consonantique', 'Accentuation'] },
    B2: { color: C.coral,  soft: C.coralSoft,  icon: Zap,     label: 'Intermédiaire+', sub: 'Nuance & prosodie',            skills: ['Discours', 'Registres', 'Prosodie'] },
    C1: { color: C.pink,   soft: C.pinkSoft,   icon: Star,    label: 'Avancé',         sub: 'Spontanéité & idiomes',        skills: ['Spontanéité', 'Idiomes', 'Intonation'] },
    C2: { color: C.gold,   soft: C.goldSoft,   icon: Trophy,  label: 'Maîtrise',       sub: 'Niveau quasi-natif',           skills: ['Euphonie', 'Élision', 'Natif'] },
  },
  en: {
    A1: { color: C.teal,   soft: C.tealSoft,   icon: Mic,     label: 'Beginner',       sub: 'Vowels & greetings',          skills: ['Vowels', 'Basic words', 'Greetings'] },
    A2: { color: C.blue,   soft: C.blueSoft,   icon: Volume2, label: 'Elementary',     sub: 'Linking sounds & phrases',    skills: ['Linking', 'Nasals', 'Rhythm'] },
    B1: { color: C.violet, soft: C.violetSoft, icon: Brain,   label: 'Intermediate',   sub: 'Fluency & advanced phonemes', skills: ['Consonants', 'Stress', 'Connected speech'] },
    B2: { color: C.coral,  soft: C.coralSoft,  icon: Zap,     label: 'Upper-Interm.',  sub: 'Nuance & prosody',            skills: ['Discourse', 'Registers', 'Prosody'] },
    C1: { color: C.pink,   soft: C.pinkSoft,   icon: Star,    label: 'Advanced',       sub: 'Spontaneity & idioms',        skills: ['Spontaneity', 'Idioms', 'Intonation'] },
    C2: { color: C.gold,   soft: C.goldSoft,   icon: Trophy,  label: 'Mastery',        sub: 'Near-native level',           skills: ['Euphony', 'Elision', 'Native-like'] },
  },
};

const UI = {
  fr: {
    pageTitle:     'Exercices',
    subtitle:      'Exercices de prononciation',
    greeting:      (name) => `Bonjour, ${name} 👋`,
    currentLevel:  () => `Ton niveau actuel : `,
    currentLvlSub: 'continue à t\'entraîner pour progresser',
    stats: [
      { icon: Flame,  label: 'Série',      val: '3 jours' },
      { icon: Trophy, label: 'Score moy.', val: '84 / 100' },
      { icon: Mic,    label: 'Sessions',   val: '12' },
    ],
    progress:      'Progression',
    current:       'ACTUEL',
    mastered:      'Maîtrisé ✓',
    completed:     'Complété',
    exercises:     (n) => `${n}/10 exercices`,
    unlock:        (prev) => `Termine ${prev} pour débloquer`,
    // Revision card
    revBadge:      'Révision espacée',
    revTitle:      (n) => n > 0 ? `${n} mot${n > 1 ? 's' : ''} à réviser` : 'Tout est à jour ✓',
    revDesc:       (n) => n > 0 ? 'Ces mots ont été ratés récemment. Révise-les pour les ancrer en mémoire.' : 'Pas de mots en attente. Continue tes exercices pour en débloquer !',
    revBtn:        (n) => n > 0 ? 'Réviser maintenant' : "Voir l'historique",
    // IA CTA
    iaBadge:       'IA · Analyse vocale intelligente',
    iaTitle:       "Générateur d'exercices personnalisés",
    iaDesc:        "L'IA génère des phrases adaptées à tes points faibles en temps réel.",
    iaBtn:         'Lancer mon défi →',
  },
  en: {
    pageTitle:     'Exercises',
    subtitle:      'Pronunciation exercises',
    greeting:      (name) => `Hello, ${name} 👋`,
    currentLevel:  () => 'Your current level: ',
    currentLvlSub: 'keep training to progress',
    stats: [
      { icon: Flame,  label: 'Streak',    val: '3 days' },
      { icon: Trophy, label: 'Avg score', val: '84 / 100' },
      { icon: Mic,    label: 'Sessions',  val: '12' },
    ],
    progress:      'Progress',
    current:       'CURRENT',
    mastered:      'Mastered ✓',
    completed:     'Completed',
    exercises:     (n) => `${n}/10 exercises`,
    unlock:        (prev) => `Complete ${prev} to unlock`,
    // Revision card
    revBadge:      'Spaced revision',
    revTitle:      (n) => n > 0 ? `${n} word${n > 1 ? 's' : ''} to review` : 'All up to date ✓',
    revDesc:       (n) => n > 0 ? 'These words were recently missed. Review them to lock them in memory.' : 'No words pending. Keep doing exercises to unlock more!',
    revBtn:        (n) => n > 0 ? 'Review now' : 'See history',
    // IA CTA
    iaBadge:       'AI · Smart voice analysis',
    iaTitle:       'Personalized exercise generator',
    iaDesc:        'AI generates sentences tailored to your weak points in real time.',
    iaBtn:         'Start my challenge →',
  },
};

const ExerciseSelection = () => {
  const { user, getCefrLevel, isCefrCompleted } = useAuth();
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const currentLevel = getCefrLevel(lang) || 'A1';
  const isCefrDone = isCefrCompleted(lang);

  if (user && !isCefrDone) { navigate('/cefr-test', { replace: true }); return null; }

  const ui  = UI[lang]            || UI.fr;
  const cfg = LEVEL_CONFIG[lang]  || LEVEL_CONFIG.fr;

  const [progressData, setProgressData] = useState({});
  const [reviewCount,  setReviewCount]  = useState(0);
  const [totalSessions, setTotalSessions] = useState(0);
  const [avgScore,      setAvgScore]      = useState(null);

  useEffect(() => {
    getExerciseProgress()
      .then(res => {
        setProgressData(res.data);
        // Compter total sessions et score moyen depuis les données de progression
        const data = res.data || {};
        let totalCompleted = 0;
        let totalScore = 0;
        let scoreCount = 0;
        Object.values(data).forEach(lvl => {
          if (lvl?.completed) totalCompleted += lvl.completed;
          if (lvl?.avgScore) { totalScore += lvl.avgScore; scoreCount++; }
        });
        setTotalSessions(totalCompleted);
        if (scoreCount > 0) setAvgScore(Math.round(totalScore / scoreCount));
      })
      .catch(() => setProgressData({}));
    getDueCount()
      .then(res => setReviewCount(res.data?.count ?? 0))
      .catch(() => {});
  }, []);

  const isLevelUnlocked = (idx) => {
    if (idx === 0) return true;
    const levelData = progressData[LEVELS_ORDER[idx]];
    if (levelData?.unlocked) return true;
    const prevLevel = LEVELS_ORDER[idx - 1];
    return progressData[prevLevel]?.done === true;
  };

  return (
    <Layout title={ui.pageTitle}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px 64px' }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 40 }}>
          <p style={{ fontWeight: 700, fontSize: '0.72rem', color: C.teal, textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 8px' }}>
            {ui.subtitle}
          </p>
          <h1 style={{ fontWeight: 900, fontSize: 'clamp(1.6rem,3vw,2.2rem)', color: C.dark, margin: '0 0 8px', letterSpacing: '-0.04em' }}>
            {ui.greeting(user?.fullName?.split(' ')[0] || (lang === 'en' ? 'Learner' : 'Apprenant'))}
          </h1>
          <p style={{ color: C.mid, fontWeight: 500, fontSize: '0.9rem', margin: 0 }}>
            {ui.currentLevel()}<strong style={{ color: C.teal }}>{currentLevel}</strong> — {ui.currentLvlSub}
          </p>
        </div>

        {/* ── Mini stats (dynamiques) ── */}
        <div style={{ display: 'flex', gap: 14, marginBottom: 44, flexWrap: 'wrap' }}>
          {[
            {
              Icon: Flame,
              label: lang === 'en' ? 'Streak' : 'Série',
              val: user?.currentStreak > 0
                ? `${user.currentStreak} ${lang === 'en' ? 'day' + (user.currentStreak > 1 ? 's' : '') : 'jour' + (user.currentStreak > 1 ? 's' : '')}`
                : '—',
              color: C.coral, soft: C.coralSoft,
            },
            {
              Icon: Trophy,
              label: lang === 'en' ? 'Avg score' : 'Score moy.',
              val: avgScore != null ? `${avgScore} / 100` : '—',
              color: C.violet, soft: C.violetSoft,
            },
            {
              Icon: Mic,
              label: lang === 'en' ? 'Sessions' : 'Sessions',
              val: totalSessions > 0 ? String(totalSessions) : '—',
              color: C.teal, soft: C.tealSoft,
            },
          ].map(({ Icon, label, val, color, soft }) => (
            <div key={label} style={{ background: C.white, border: `1.5px solid ${C.border}`, borderRadius: 16, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12, flex: '1 1 160px' }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: soft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon style={{ width: 18, height: 18, color }} />
              </div>
              <div>
                <p style={{ fontWeight: 700, fontSize: '0.62rem', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>{label}</p>
                <p style={{ fontWeight: 800, fontSize: '0.95rem', color: C.dark, margin: 0 }}>{val}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Level grid ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 20 }}>
          {LEVELS_ORDER.map((level, idx) => {
            const isUnlocked = isLevelUnlocked(idx);
            const isCurrent  = level === currentLevel;
            const lcfg       = cfg[level];
            const LevelIcon  = lcfg.icon;
            const prog       = progressData[level] || { completed: 0, total: 10, done: false };
            const pct        = prog.done ? 100 : Math.round(((prog.completed || 0) / 10) * 100);

            return (
              <div key={level}
                onClick={() => isUnlocked && navigate(`/exercises/${level}`)}
                style={{
                  background: C.white,
                  borderRadius: 20,
                  border: `1.5px solid ${isUnlocked ? lcfg.color + '40' : C.border}`,
                  padding: '1.5rem',
                  cursor: isUnlocked ? 'pointer' : 'default',
                  opacity: isUnlocked ? 1 : 0.5,
                  transition: 'transform .18s, box-shadow .18s',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onMouseEnter={e => { if (isUnlocked) { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = `0 16px 40px ${lcfg.color}20`; }}}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}>

                {/* Current badge */}
                {isCurrent && (
                  <div style={{ position: 'absolute', top: 14, right: 14, background: lcfg.color, color: 'white', borderRadius: 999, padding: '3px 10px', fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.06em' }}>
                    {ui.current}
                  </div>
                )}

                {/* Icon + level label */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: isUnlocked ? lcfg.soft : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {isUnlocked
                      ? <LevelIcon style={{ width: 22, height: 22, color: lcfg.color }} />
                      : <Lock style={{ width: 18, height: 18, color: C.muted }} />
                    }
                  </div>
                  <div>
                    <p style={{ fontWeight: 900, fontSize: '0.75rem', color: lcfg.color, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>{level}</p>
                    <p style={{ fontWeight: 800, fontSize: '0.95rem', color: C.dark, margin: 0 }}>{lcfg.label}</p>
                  </div>
                </div>

                <p style={{ fontSize: '0.8rem', color: C.mid, fontWeight: 500, margin: '0 0 14px', lineHeight: 1.5 }}>{lcfg.sub}</p>

                {/* Skills */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                  {lcfg.skills.map(s => (
                    <span key={s} style={{ background: lcfg.soft, color: lcfg.color, borderRadius: 999, padding: '3px 10px', fontSize: '0.65rem', fontWeight: 700 }}>{s}</span>
                  ))}
                </div>

                {/* Progress bar */}
                {isUnlocked && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{ui.progress}</span>
                      <span style={{ fontSize: '0.68rem', fontWeight: 800, color: lcfg.color }}>{pct}%</span>
                    </div>
                    <div style={{ height: 5, background: lcfg.soft, borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: lcfg.color, borderRadius: 999, transition: 'width 1s ease' }} />
                    </div>
                  </div>
                )}

                {/* CTA */}
                {isUnlocked ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: lcfg.color }}>
                      {prog.mastered ? ui.mastered : prog.done ? ui.completed : ui.exercises(prog.completed || 0)}
                    </span>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: lcfg.soft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ArrowRight style={{ width: 15, height: 15, color: lcfg.color }} />
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Lock style={{ width: 13, height: 13, color: C.muted }} />
                    <span style={{ fontSize: '0.72rem', color: C.muted, fontWeight: 600 }}>
                      {ui.unlock(LEVELS_ORDER[idx - 1])}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {/* ── Pratique ciblée + Révision cards ── */}
        <div style={{ marginTop: 36, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>
          {/* Révision espacée */}
          <div
            onClick={() => navigate('/exercises/revision')}
            style={{ background: `linear-gradient(135deg,${C.coral},${C.coralDark})`, borderRadius: 20, padding: '1.5rem', cursor: 'pointer', position: 'relative', overflow: 'hidden', transition: 'transform .18s,box-shadow .18s' }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 14px 36px ${C.coral}44`; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
          >
            <div style={{ position: 'absolute', right: -16, top: -16, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <RotateCcw style={{ width: 20, height: 20, color: 'white' }} />
              </div>
              <div>
                <p style={{ fontWeight: 800, fontSize: '0.65rem', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>{ui.revBadge}</p>
                <p style={{ fontWeight: 900, fontSize: '1rem', color: 'white', margin: 0 }}>{ui.revTitle(reviewCount)}</p>
              </div>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.72)', fontWeight: 500, margin: '0 0 16px', lineHeight: 1.5 }}>
              {ui.revDesc(reviewCount)}
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ background: 'rgba(255,255,255,0.2)', color: 'white', borderRadius: 999, padding: '4px 12px', fontSize: '0.72rem', fontWeight: 800 }}>
                {ui.revBtn(reviewCount)}
              </span>
              <ArrowRight style={{ width: 18, height: 18, color: 'rgba(255,255,255,0.8)' }} />
            </div>
          </div>
        </div>

      </div>
    </Layout>
  );
};

export default ExerciseSelection;
