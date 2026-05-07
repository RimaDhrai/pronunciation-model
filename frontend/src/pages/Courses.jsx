/**
 * src/pages/Courses.jsx — Parcours A1→C2
 */
import { useState, useEffect } from 'react';
import Layout from '../components/layout/Layout';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { getAllCourses, getMyCourses, enrollCourse } from '../api/courses';
import { Lock, CheckCircle2, PlayCircle, Loader2, BookOpen, Zap, Mic, Volume2, Brain, Star, Trophy } from 'lucide-react';

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
    A1: { label: 'Débutant',       icon: Mic,     color: C.teal,   soft: C.tealSoft,   desc: 'Voyelles et phrases simples du quotidien' },
    A2: { label: 'Élémentaire',    icon: Volume2, color: C.blue,   soft: C.blueSoft,   desc: 'Liaisons, nasales et expressions usuelles' },
    B1: { label: 'Intermédiaire',  icon: Brain,   color: C.violet, soft: C.violetSoft, desc: 'Fluidité modérée et phonèmes avancés' },
    B2: { label: 'Intermédiaire+', icon: Zap,     color: C.coral,  soft: C.coralSoft,  desc: 'Expression nuancée et prosodie naturelle' },
    C1: { label: 'Avancé',         icon: Star,    color: C.pink,   soft: C.pinkSoft,   desc: 'Spontanéité et maîtrise des idiomes' },
    C2: { label: 'Maîtrise',       icon: Trophy,  color: C.gold,   soft: C.goldSoft,   desc: 'Niveau quasi-natif, précision parfaite' },
  },
  en: {
    A1: { label: 'Beginner',       icon: Mic,     color: C.teal,   soft: C.tealSoft,   desc: 'Vowels and simple everyday sentences' },
    A2: { label: 'Elementary',     icon: Volume2, color: C.blue,   soft: C.blueSoft,   desc: 'Linking sounds, nasals and common expressions' },
    B1: { label: 'Intermediate',   icon: Brain,   color: C.violet, soft: C.violetSoft, desc: 'Moderate fluency and advanced phonemes' },
    B2: { label: 'Upper-Interm.',  icon: Zap,     color: C.coral,  soft: C.coralSoft,  desc: 'Nuanced expression and natural prosody' },
    C1: { label: 'Advanced',       icon: Star,    color: C.pink,   soft: C.pinkSoft,   desc: 'Spontaneity and mastery of idioms' },
    C2: { label: 'Mastery',        icon: Trophy,  color: C.gold,   soft: C.goldSoft,   desc: 'Near-native level, perfect precision' },
  }
};

const UI_COURSES = {
  fr: {
    title: 'Cours', subtitle: 'Parcours de cours', heading: 'Ton parcours A1 → C2',
    levelDetected: 'Niveau détecté', complete: 'complète chaque section pour progresser',
    yourLevel: 'TON NIVEAU', courses: 'cours',
    noCourse: 'Aucun cours disponible pour ce niveau.',
    unlockHint: (prev) => `Complète ${prev} pour déverrouiller`,
    btnReview: 'Revoir', btnContinue: 'Continuer', btnStart: 'Commencer', btnCompleted: 'Complété',
    allDoneTitle: 'Parcours Complété !',
    allDoneSub: 'Tu as maîtrisé tous les niveaux A1 → C2. Félicitations !',
  },
  en: {
    title: 'Courses', subtitle: 'Course path', heading: 'Your path A1 → C2',
    levelDetected: 'Detected level', complete: 'complete each section to progress',
    yourLevel: 'YOUR LEVEL', courses: 'courses',
    noCourse: 'No courses available for this level.',
    unlockHint: (prev) => `Complete ${prev} to unlock`,
    btnReview: 'Review', btnContinue: 'Continue', btnStart: 'Start', btnCompleted: 'Completed',
    allDoneTitle: 'Path Completed!',
    allDoneSub: 'You have mastered all levels A1 → C2. Congratulations!',
  }
};

const normalize = (c) => c ? ({
  ...c,
  id:        c.id,
  title:     c.title || c.name || 'Cours sans titre',
  cefrLevel: (c.cefrLevel || c.cefr_level || c.level || '').toUpperCase(),
}) : null;

export default function Courses() {
  const { user, getCefrLevel } = useAuth();
  const { lang } = useLanguage();
  const ui = UI_COURSES[lang] || UI_COURSES.fr;
  const levelCfg = LEVEL_CONFIG[lang] || LEVEL_CONFIG.fr;
  const navigate = useNavigate();

  const isCefrDone   = user?.cefrCompleted || user?.cefr_completed;
  const userLevel    = getCefrLevel() || 'A1';
  const userLevelIdx = LEVELS_ORDER.indexOf(userLevel);

  const [allCourses, setAllCourses] = useState([]);
  const [enrolled,   setEnrolled]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [enrolling,  setEnrolling]  = useState(null);

  useEffect(() => {
    if (user && !isCefrDone) { navigate('/cefr-test', { replace: true }); return; }
    fetchData();
  }, [user, isCefrDone, lang]);

  const fetchData = async () => {
    setLoading(true);
    const [allRes, myRes] = await Promise.allSettled([getAllCourses(lang), getMyCourses()]);
    if (allRes.status === 'fulfilled')
      setAllCourses((Array.isArray(allRes.value.data) ? allRes.value.data : []).map(normalize).filter(Boolean));
    if (myRes.status === 'fulfilled') {
      const raw = Array.isArray(myRes.value.data) ? myRes.value.data : [];
      setEnrolled(raw.map(item => ({ course: normalize(item.course || item), progress: item.progress || { progressPercent: 0 } })).filter(e => e.course));
    }
    setLoading(false);
  };

  const byLevel         = LEVELS_ORDER.reduce((acc, lvl) => { acc[lvl] = allCourses.filter(c => c.cefrLevel === lvl); return acc; }, {});
  const progressOf      = (id) => enrolled.find(e => e.course?.id === id)?.progress?.progressPercent || 0;
  const isSectionDone   = (lvl) => { const cs = byLevel[lvl]; return !cs.length || cs.every(c => progressOf(c.id) >= 100); };
  const isSectionAccessible = (lvl) => {
    const idx = LEVELS_ORDER.indexOf(lvl);
    if (idx <= userLevelIdx || idx === 0) return true;
    return isSectionDone(LEVELS_ORDER[idx - 1]);
  };

  const handleEnroll = async (courseId) => {
    setEnrolling(courseId);
    try { await enrollCourse(courseId); } catch {}
    setEnrolling(null);
    navigate(`/courses/${courseId}`);
  };

  if (!isCefrDone) return null;

  if (loading) return (
    <Layout title={ui.title}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <Loader2 style={{ width: 36, height: 36, color: C.teal, animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </Layout>
  );

  const isMobile = window.innerWidth < 640;

  return (
    <Layout title={ui.subtitle}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: isMobile ? '16px 12px 60px' : '40px 24px 80px' }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 44 }}>
          <p style={{ fontWeight: 700, fontSize: '0.72rem', color: C.teal, textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 8px' }}>
            {ui.subtitle}
          </p>
          <h1 style={{ fontWeight: 900, fontSize: 'clamp(1.6rem,3vw,2.2rem)', color: C.dark, margin: '0 0 8px', letterSpacing: '-0.04em' }}>
            {ui.heading}
          </h1>
          <p style={{ color: C.mid, fontWeight: 500, fontSize: '0.88rem', margin: 0 }}>
            {ui.levelDetected} : <strong style={{ color: C.teal }}>{userLevel}</strong> — {ui.complete}
          </p>
        </div>

        {/* ── Level sections ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {LEVELS_ORDER.map((level, sectionIdx) => {
            const cfg        = levelCfg[level];
            const LevelIcon  = cfg.icon;
            const accessible = isSectionAccessible(level);
            const done       = isSectionDone(level);
            const courses    = byLevel[level];
            const isCurrent  = level === userLevel;
            return (
              <div key={level} style={{ borderRadius: 20, overflow: 'hidden', border: `1.5px solid ${accessible ? cfg.color + '35' : C.border}`, background: C.white, opacity: accessible ? 1 : 0.55 }}>

                {/* Section header */}
                <div style={{ padding: isMobile ? '14px 14px' : '18px 22px', display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 14, background: accessible ? cfg.soft : '#F9FAFB', borderBottom: courses.length > 0 ? `1px solid ${accessible ? cfg.color + '20' : C.border}` : 'none' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 14, background: accessible ? cfg.color : '#E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {accessible
                      ? <LevelIcon style={{ width: 20, height: 20, color: 'white' }} />
                      : <Lock style={{ width: 18, height: 18, color: C.muted }} />
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 900, fontSize: '1rem', color: accessible ? C.dark : C.muted, letterSpacing: '-0.02em' }}>{cfg.label}</span>
                      <span style={{ background: accessible ? cfg.color : '#D1D5DB', color: 'white', borderRadius: 999, padding: '2px 9px', fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.06em' }}>{level}</span>
                      {isCurrent && <span style={{ background: cfg.color, color: 'white', borderRadius: 999, padding: '2px 9px', fontSize: '0.6rem', fontWeight: 800 }}>{ui.yourLevel}</span>}
                      {done && courses.length > 0 && <CheckCircle2 style={{ width: 16, height: 16, color: cfg.color }} />}
                    </div>
                    <p style={{ fontWeight: 500, fontSize: '0.78rem', color: C.mid, margin: '3px 0 0' }}>
                      {accessible ? cfg.desc : ui.unlockHint(LEVELS_ORDER[sectionIdx - 1] || '')}
                    </p>
                  </div>
                  {accessible && courses.length > 0 && (
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ fontWeight: 900, fontSize: '1rem', color: cfg.color, margin: 0 }}>
                        {courses.filter(c => progressOf(c.id) >= 100).length}<span style={{ color: C.muted, fontWeight: 600 }}>/{courses.length}</span>
                      </p>
                      <p style={{ fontSize: '0.6rem', color: C.muted, fontWeight: 600, margin: '2px 0 0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{ui.courses}</p>
                    </div>
                  )}
                </div>

                {/* Course rows */}
                {accessible && courses.length > 0 && (
                  <div style={{ padding: '10px 16px 14px' }}>
                    {courses.map((course, courseIdx) => {
                      const pct         = progressOf(course.id);
                      const isCompleted = pct >= 100;
                      const prevDone    = courseIdx === 0 || progressOf(courses[courseIdx - 1].id) >= 100;
                      const isUnlocked  = prevDone;
                      const isEnrolled  = enrolled.some(e => e.course?.id === course.id);

                      return (
                        <div key={course.id}
                          style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 10px', borderRadius: 14, transition: 'background .15s', cursor: isUnlocked ? 'pointer' : 'default' }}
                          onMouseEnter={e => { if (isUnlocked) e.currentTarget.style.background = cfg.soft + '60'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                          onClick={() => isUnlocked && (isEnrolled ? navigate(`/courses/${course.id}`) : handleEnroll(course.id))}>

                          {/* Number / status */}
                          <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isCompleted ? cfg.color : isUnlocked ? cfg.soft : '#F3F4F6', border: `1.5px solid ${isCompleted ? cfg.color : isUnlocked ? cfg.color + '40' : C.border}` }}>
                            {isCompleted
                              ? <CheckCircle2 style={{ width: 16, height: 16, color: 'white' }} />
                              : isUnlocked
                                ? <span style={{ fontSize: '0.75rem', fontWeight: 800, color: cfg.color }}>{courseIdx + 1}</span>
                                : <Lock style={{ width: 13, height: 13, color: C.muted }} />}
                          </div>

                          {/* Title + progress */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontWeight: 700, fontSize: isMobile ? '0.8rem' : '0.88rem', color: isUnlocked ? C.dark : C.muted, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: isMobile ? 'normal' : 'nowrap' }}>{course.title}</p>
                            {isUnlocked && !isCompleted && pct > 0 && (
                              <div style={{ marginTop: 5, height: 3, background: cfg.soft, borderRadius: 999, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${pct}%`, background: cfg.color, borderRadius: 999 }} />
                              </div>
                            )}
                            {isCompleted && <p style={{ fontSize: '0.68rem', color: cfg.color, fontWeight: 700, margin: '2px 0 0' }}>{ui.btnCompleted}</p>}
                          </div>

                          {/* Action button */}
                          {isUnlocked && (
                            <button
                              disabled={!!enrolling}
                              onClick={e => { e.stopPropagation(); isEnrolled ? navigate(`/courses/${course.id}`) : handleEnroll(course.id); }}
                              style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, padding: isMobile ? '7px 10px' : '7px 14px', borderRadius: 10, fontWeight: 700, fontSize: '0.7rem', color: isCompleted ? cfg.color : 'white', background: isCompleted ? cfg.soft : cfg.color, border: 'none', cursor: 'pointer', transition: 'opacity .15s' }}
                              onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                              onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                              {enrolling === course.id
                                ? <Loader2 style={{ width: 13, height: 13, animation: 'spin 1s linear infinite' }} />
                                : isCompleted
                                  ? <><BookOpen style={{ width: 13, height: 13 }} />{!isMobile && ` ${ui.btnReview}`}</>
                                  : isEnrolled
                                    ? <><PlayCircle style={{ width: 13, height: 13 }} />{!isMobile && ` ${ui.btnContinue}`}</>
                                    : <><Zap style={{ width: 13, height: 13 }} />{!isMobile && ` ${ui.btnStart}`}</>}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {accessible && courses.length === 0 && (
                  <div style={{ padding: '20px', textAlign: 'center' }}>
                    <p style={{ fontSize: '0.82rem', color: C.muted, fontWeight: 500, margin: 0 }}>{ui.noCourse}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── All done ── */}
        {LEVELS_ORDER.every(lvl => isSectionDone(lvl) && byLevel[lvl].length > 0) && (
          <div style={{ marginTop: 40, background: C.dark, borderRadius: 24, padding: '2.5rem', textAlign: 'center', color: 'white', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -30, right: -30, width: 150, height: 150, borderRadius: '50%', background: `${C.teal}15` }} />
            <div style={{ width: 60, height: 60, borderRadius: 18, background: `linear-gradient(135deg,${C.gold},${C.coral})`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: `0 8px 24px ${C.gold}44` }}>
              <Trophy style={{ width: 28, height: 28, color: 'white' }} />
            </div>
            <h2 style={{ fontWeight: 900, fontSize: '1.5rem', margin: '0 0 8px', letterSpacing: '-0.03em' }}>{ui.allDoneTitle}</h2>
            <p style={{ fontWeight: 500, opacity: 0.7, fontSize: '0.9rem', margin: 0 }}>{ui.allDoneSub}</p>
          </div>
        )}

        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </Layout>
  );
}
