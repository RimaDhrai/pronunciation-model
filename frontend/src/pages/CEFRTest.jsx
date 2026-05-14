// src/pages/CEFRTest.jsx — Duolingo-style · palette Landing Page
import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import AppLayout from "../components/layout/AppLayout";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import api from "../api/axios";
import {
  Mic, Trophy, ArrowRight, Loader2, CheckCircle,
  BookOpen, GraduationCap, ChevronRight, RotateCcw, X,
  TrendingUp, Heart, Zap,
} from "lucide-react";

const TOTAL_STEPS  = 20;
const MAX_LIVES    = 3;

/* ── Palette Landing Page ───────────────────────────────────────────── */
const C = {
  bg:       '#FEF8F3',
  white:    '#FFFFFF',
  dark:     '#1C2B3A',
  mid:      '#5F7183',
  muted:    '#9BB0C2',
  border:   '#EEE8E0',
  teal:     '#80DCDC',
  tealDark: '#4DBFBF',
  tealDeep: '#2E9898',
  coral:    '#E8926A',
  violet:   '#9580D4',
  gold:     '#F0C85A',
  pink:     '#E8476A',
  pinkDark: '#C8305A',
};

const LEVEL_COLORS = {
  A1: { g0:'#80DCDC', g1:'#4DBFBF', text:'#2A9090', glow:'#80DCDC35' },
  A2: { g0:'#6BACD4', g1:'#4A90BD', text:'#3A7BAD', glow:'#6BACD435' },
  B1: { g0:'#9580D4', g1:'#7D66C0', text:'#6B52C8', glow:'#9580D435' },
  B2: { g0:'#E8926A', g1:'#D47A52', text:'#C06A40', glow:'#E8926A35' },
  C1: { g0:'#D46A60', g1:'#C05048', text:'#A84A42', glow:'#D46A6035' },
  C2: { g0:'#F0C85A', g1:'#B88C36', text:'#A87C20', glow:'#F0C85A35' },
};

const LEVEL_DESC = {
  fr: {
    A1:{ label:'Débutant',        emoji:'🌱', desc:'Tu maîtrises les bases de la prononciation.' },
    A2:{ label:'Élémentaire',     emoji:'📗', desc:'Tu te fais comprendre sur des sujets simples.' },
    B1:{ label:'Intermédiaire',   emoji:'📘', desc:'Tu te débrouilles dans la plupart des situations.' },
    B2:{ label:'Inter. Avancé',   emoji:'📙', desc:"Tu t'exprimes avec aisance sur des sujets variés." },
    C1:{ label:'Avancé',          emoji:'📕', desc:'Tu utilises la langue de façon naturelle et précise.' },
    C2:{ label:'Maîtrise',        emoji:'🏆', desc:'Niveau quasi natif — excellent !' },
  },
  en: {
    A1:{ label:'Beginner',        emoji:'🌱', desc:'You have mastered essential pronunciation basics.' },
    A2:{ label:'Elementary',      emoji:'📗', desc:'You make yourself understood on familiar topics.' },
    B1:{ label:'Intermediate',    emoji:'📘', desc:'You manage most everyday situations comfortably.' },
    B2:{ label:'Upper-Inter.',    emoji:'📙', desc:'You express yourself fluently on complex topics.' },
    C1:{ label:'Advanced',        emoji:'📕', desc:'You use the language naturally and precisely.' },
    C2:{ label:'Mastery',         emoji:'🏆', desc:'Near-native command — outstanding!' },
  },
};

/* ── Animated score ─────────────────────────────────────────────────── */
function AnimatedScore({ target }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let cur = 0; const step = target / 24;
    const id = setInterval(() => {
      cur = Math.min(cur + step, target); setN(Math.round(cur));
      if (cur >= target) clearInterval(id);
    }, 35);
    return () => clearInterval(id);
  }, [target]);
  const col = n >= 75 ? C.tealDeep : n >= 55 ? C.violet : C.pink;
  return (
    <span style={{ color: col, fontSize: 54, fontWeight: 900, lineHeight: 1, fontFamily:'Nunito,sans-serif' }}>
      {n}<span style={{ fontSize: 19, opacity:.5 }}>/100</span>
    </span>
  );
}

/* ── Step dots ──────────────────────────────────────────────────────── */
function StepDots({ step, total, history }) {
  return (
    <div style={{ display:'flex', gap:3, flexWrap:'wrap', justifyContent:'center' }}>
      {Array.from({ length: total }).map((_, i) => {
        const done   = i < history.length;
        const active = i === step - 1;
        const sc     = done ? history[i]?.score : null;
        const col    = sc == null ? '#E8E4DF' : sc >= 75 ? C.tealDark : sc >= 55 ? C.violet : C.pink;
        return (
          <div key={i} style={{
            width: active ? 20 : 6, height: 6, borderRadius: 4,
            background: active ? C.teal : (done ? col : '#E8E4DF'),
            transition: 'all .3s ease',
          }} />
        );
      })}
    </div>
  );
}

/* ── Hearts ─────────────────────────────────────────────────────────── */
function Hearts({ lives, max = MAX_LIVES }) {
  return (
    <div style={{ display:'flex', gap:4 }}>
      {Array.from({ length: max }).map((_, i) => (
        <Heart key={i} size={18}
          fill={i < lives ? C.pink : 'none'}
          color={i < lives ? C.pink : '#DDD'}
          style={{ transition:'all .3s', filter: i < lives ? `drop-shadow(0 1px 4px ${C.pink}60)` : 'none' }}
        />
      ))}
    </div>
  );
}

/* ── Global CSS ─────────────────────────────────────────────────────── */
const css = `
  @keyframes spin     { to { transform: rotate(360deg); } }
  @keyframes float    { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-9px)} }
  @keyframes fadeUp   { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
  @keyframes pop      { from{opacity:0;transform:scale(.88) translateY(12px)} to{opacity:1;transform:scale(1) translateY(0)} }
  @keyframes rippleTeal { 0%{box-shadow:0 0 0 0 rgba(128,220,220,.55)} 100%{box-shadow:0 0 0 24px rgba(128,220,220,0)} }
  @keyframes ripplePink { 0%{box-shadow:0 0 0 0 rgba(232,71,106,.55)} 100%{box-shadow:0 0 0 24px rgba(232,71,106,0)} }
  @keyframes xpFly   { 0%{opacity:0;transform:translateY(0) scale(.8)} 40%{opacity:1;transform:translateY(-20px) scale(1.15)} 100%{opacity:0;transform:translateY(-50px)} }
  @keyframes heartLost { 0%{transform:scale(1)} 30%{transform:scale(1.4)} 60%{transform:scale(.8)} 100%{transform:scale(1)} }
`;

/* ══════════════════════════════════════════════════════════════════════ */
export default function CEFRTest() {
  const { updateUser, user } = useAuth();
  const userName = user?.fullName || user?.name || user?.email?.split('@')[0] || '';
  const { lang }       = useLanguage();
  const navigate       = useNavigate();
  const isFr           = lang !== 'en';
  const ldMap          = LEVEL_DESC[lang] || LEVEL_DESC.fr;
  const t              = (fr, en) => isFr ? fr : en;

  const [phase,        setPhase]        = useState('intro');
  const [sessionId,    setSessionId]    = useState(null);
  const [step,         setStep]         = useState(1);
  const [soundLabel,   setSoundLabel]   = useState('');
  const [phrase,       setPhrase]       = useState('');
  const [instruction,  setInstruction]  = useState('');
  const [estLevel,     setEstLevel]     = useState('B1');
  const [recState,     setRecState]     = useState('idle');
  const [audioUrl,     setAudioUrl]     = useState(null);
  const [history,      setHistory]      = useState([]);
  const [lastFeedback, setLastFeedback] = useState('');
  const [lastScore,    setLastScore]    = useState(null);
  const [result,       setResult]       = useState(null);
  const [error,        setError]        = useState(null);
  const [confirmQuit,  setConfirmQuit]  = useState(false);
  const [unlocked,     setUnlocked]     = useState(false);
  const [showTip,      setShowTip]      = useState(false);
  const [nextData,     setNextData]     = useState(null);
  const [lives,        setLives]        = useState(MAX_LIVES);
  const [xp,           setXp]           = useState(0);
  const [xpAnim,       setXpAnim]       = useState(null);
  const [waitingNext,  setWaitingNext]  = useState(false);
  const [analyzeData,  setAnalyzeData]  = useState(null);  // full /analyze response (ops + phonemes)
  const [llmLoading,   setLlmLoading]   = useState(false); // true while /feedback LLM is pending
  const [progression,  setProgression]  = useState(null);  // score progression over sessions

  const capturedBlob   = useRef(null);
  const recStartTimeRef = useRef(null);
  const { startRecording, stopRecording, resetRecording } = useAudioRecorder();

  // Fetch score progression when results appear
  useEffect(() => {
    if (phase !== 'result') return;
    api.get('/api/level-test/progression').then(r => setProgression(r.data)).catch(() => {});
  }, [phase]);

  // Auto-advance as soon as nextData arrives if user already clicked "Continuer"
  useEffect(() => {
    if (nextData && waitingNext) {
      setWaitingNext(false);
      applyStep(nextData);
      setPhase('testing');
    }
  }, [nextData, waitingNext]);

  const handleContinue = () => {
    if (nextData) {
      applyStep(nextData);
      setPhase('testing');
    } else {
      setWaitingNext(true);
    }
  };

  const gainXp = (amount) => {
    setXp(p => p + amount);
    setXpAnim(amount);
    setTimeout(() => setXpAnim(null), 900);
  };

  /* ── Start ────────────────────────────────────────────────────────── */
  const handleStart = async () => {
    setError(null); setPhase('loading');
    try {
      const res = await api.post(`/api/level-test/start?lang=${lang}`);
      applyStep(res.data); setPhase('testing');
    } catch (e) {
      const data = e.response?.data;
      setError(e.response?.status === 503 || data?.error === 'OLLAMA_DOWN'
        ? t('⚠️ Service indisponible. Réessaie dans quelques instants.', '⚠️ Service unavailable. Please try again in a moment.')
        : t('Erreur : ', 'Error: ') + (data?.message || data?.error || e.message));
      setPhase('intro');
    }
  };

  const applyStep = (data) => {
    setSessionId(data.session_id || sessionId);
    setStep(data.step || 1);
    setSoundLabel(data.sound_label || data.target_sound || '');
    setPhrase(data.phrase || '');
    setInstruction(data.instruction || '');
    setEstLevel(data.estimated_level || 'B1');
    setRecState('idle'); setAudioUrl(null); setShowTip(false);
    setAnalyzeData(null); setLlmLoading(false); setError(null);
    capturedBlob.current = null; resetRecording();
  };

  /* ── Recording ────────────────────────────────────────────────────── */
  const handleStartRec = async () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null); capturedBlob.current = null; setError(null);
    setRecState('recording');
    await startRecording();
    recStartTimeRef.current = Date.now();
  };

  const handleStopRec = async () => {
    if (recStartTimeRef.current && Date.now() - recStartTimeRef.current < 500) {
      await stopRecording();
      setRecState('idle');
      setError(t('Enregistrement trop court.', 'Recording too short.')); return;
    }
    const blob = await stopRecording();
    if (!blob || blob.size < 500) { setError(t('Enregistrement trop court.', 'Recording too short.')); setRecState('idle'); return; }
    capturedBlob.current = blob;
    setAudioUrl(URL.createObjectURL(blob));
    setRecState('recorded');
  };

  const handleReRecord = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null); capturedBlob.current = null;
    setError(null); resetRecording(); setRecState('idle');
  };

  /* ── Submit ───────────────────────────────────────────────────────── */
  const handleSubmit = async () => {
    const blob = capturedBlob.current;
    if (!blob) return;
    setRecState('processing'); setError(null);
    try {
      const fd = new FormData();
      fd.append('file', blob, 'audio.wav');
      fd.append('expectedPhrase', phrase);
      fd.append('lang', lang);
      fd.append('level', estLevel);

      // ── STEP 1 : Whisper + G2P/IPA (~3-4s) ───────────────────────────
      let audioScore = 0;
      let fullData   = null;
      try {
        const r = await fetch('/analyze', { method: 'POST', body: fd });
        if (r.ok) {
          const d = await r.json();
          fullData = d;
          if (!d.stt_error) {
            audioScore = Math.round((d.word_diff_score ?? 0) * 0.6 + (d.avg_confidence ?? 0) * 100 * 0.4);
            // G2P penalty: weak phonemes reduce score by up to 20 pts
            const weakCount  = d.phonemes?.weak_phonemes?.length ?? 0;
            const totalCount = d.phonemes?.word_phonemes?.length || 1;
            const phonemePenalty = Math.round((weakCount / totalCount) * 20);
            audioScore = Math.max(0, audioScore - phonemePenalty);
          }
        }
      } catch { /* keep 0 */ }

      // ── STEP 2 : Score + G2P affiché IMMÉDIATEMENT ───────────────────
      const newHistory = [...history, { sound: soundLabel, score: audioScore, phrase }];
      setHistory(newHistory); setLastScore(audioScore); setNextData(null);
      setAnalyzeData(fullData);

      const quickFb = isFr
        ? (audioScore >= 75 ? `Excellent ! Tu prononces très bien le son « ${soundLabel} ». 🌟`
           : audioScore >= 55 ? `Bien joué ! Le son « ${soundLabel} » avec quelques imperfections. 👍`
           : `Ce son « ${soundLabel} » est difficile. Concentre-toi sur la position de ta langue ! 💪`)
        : (audioScore >= 75 ? `Excellent! "${soundLabel}" very well pronounced. 🌟`
           : audioScore >= 55 ? `Well done! Getting "${soundLabel}" with a few imperfections. 👍`
           : `"${soundLabel}" is tricky. Focus on your mouth position! 💪`);
      setLastFeedback(quickFb);
      setPhase('feedback');

      if (audioScore >= 75) gainXp(15);
      else if (audioScore >= 55) gainXp(10);
      else { gainXp(5); if (audioScore < 40) setLives(l => Math.max(0, l - 1)); }

      // ── TASK 1 : feedback IA (attend le retour avant de lancer la phrase suivante)
      // ── TASK 2 : next-phrase démarre APRÈS le retour de /feedback (évite la race condition
      //            sur l'état LangGraph — /feedback incrémente le step avant que /next-phrase le lise)
      setLlmLoading(true);

      try {
        const fbRes = await api.post(
          `/api/level-test/feedback?sessionId=${encodeURIComponent(sessionId)}&phrase=${encodeURIComponent(phrase)}&score=${audioScore}`
        );
        const fb = fbRes.data;

        if (fb.done) {
          setResult(fb); setPhase('result');
          if (fb.final_level && updateUser)
            await updateUser({ cefr_level: fb.final_level, cefr_completed: true }).catch(() => {});
          // Propager le niveau + faiblesses au MasterAgent
          const masterSid = localStorage.getItem('masterSessionId');
          if (masterSid) {
            api.post('/api/master/turn', {
              session_id: masterSid,
              mode: 'TEST_FINISH',
              lang,
              phoneme_errors: fb.weaknesses || [],
            }).catch(() => {});
          }
          setUnlocked(true);
          return;
        }
        if (fb.feedback?.trim().length > 10) setLastFeedback(fb.feedback);
        if (fb.estimated_level) setEstLevel(fb.estimated_level);

        // TASK 2 : maintenant que /feedback a incrémenté le step, on peut charger la phrase suivante
        // L'utilisateur lit le feedback (~2-3s) pendant que le backend charge la phrase
        api
          .post(`/api/level-test/next-phrase?sessionId=${encodeURIComponent(sessionId)}`)
          .then(res => setNextData(res.data))
          .catch(() => {});

      } catch {
        setError(t('Analyse lente, continue quand même.', 'Analysis slow, continue anyway.'));
      } finally {
        setLlmLoading(false);
      }
    } catch (e) {
      setError(t('Erreur analyse : ', 'Analysis error: ') + (e.response?.data?.error || e.message));
      setRecState('idle');
    }
  };

  /* ── Quit ─────────────────────────────────────────────────────────── */
  const handleQuit = () => {
    if (sessionId) api.post(`/api/level-test/finish?sessionId=${encodeURIComponent(sessionId)}`).catch(() => {});
    resetAll();
    navigate('/master');
  };

  const resetAll = () => {
    setPhase('intro'); setSessionId(null); setHistory([]); setResult(null);
    setStep(1); setRecState('idle'); setAudioUrl(null); setError(null);
    setConfirmQuit(false); setUnlocked(false); capturedBlob.current = null; resetRecording();
    setAnalyzeData(null); setLlmLoading(false);
    setLives(MAX_LIVES); setXp(0);
  };

  /* ══════════════════════════════════════════════════════════════════════
     INTRO / LOADING
  ══════════════════════════════════════════════════════════════════════ */
  if (phase === 'intro' || phase === 'loading') return (
    <AppLayout title={t('Test de Niveau', 'Level Test')}>
      <style>{css}</style>
      <div style={{ background:C.bg, minHeight:'80vh', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px 16px' }}>
        <div style={{ width:'100%', maxWidth:440, animation:'fadeUp .45s ease', fontFamily:"'Plus Jakarta Sans',Nunito,sans-serif" }}>

          {/* Animated mic icon */}
          <div style={{ textAlign:'center', marginBottom:22 }}>
            <div style={{
              display:'inline-flex', alignItems:'center', justifyContent:'center',
              width:96, height:96, borderRadius:28,
              background:`linear-gradient(145deg,${C.teal},${C.tealDeep})`,
              boxShadow:`0 18px 42px ${C.teal}45`,
              animation:'float 3.5s ease-in-out infinite',
            }}>
              <Mic size={46} color="white" strokeWidth={1.6} />
            </div>
          </div>

          {/* Badge */}
          <div style={{ textAlign:'center', marginBottom:10 }}>
            <span style={{
              display:'inline-flex', alignItems:'center', gap:6,
              background:`${C.teal}18`, border:`1.5px solid ${C.teal}45`,
              borderRadius:999, padding:'5px 16px',
              fontSize:'0.68rem', fontWeight:800, color:C.tealDeep, letterSpacing:'0.1em', textTransform:'uppercase',
            }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:C.teal, display:'inline-block' }} />
              SpeakCoach AI
            </span>
          </div>

          {/* Title */}
          <h1 style={{ fontFamily:'Nunito,sans-serif', fontWeight:900, fontSize:28, color:C.dark, textAlign:'center', marginBottom:8, letterSpacing:'-0.02em' }}>
            {t('Évalue ton niveau', 'Evaluate your level')}
          </h1>
          <p style={{ fontSize:13.5, color:C.mid, textAlign:'center', marginBottom:22, lineHeight:1.65 }}>
            {t(
              "Prononce 20 phrases courtes. Notre coach analyse ta voix et révèle ton niveau en temps réel.",
              "Speak 20 short phrases. Our coach analyses your voice and reveals your level in real time."
            )}
          </p>

          {/* Feature cards */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:9, marginBottom:18 }}>
            {[
              { emoji:'🎙', label:t('20 phrases','20 phrases'), color:C.teal,   bg:`${C.teal}12`   },
              { emoji:'⚡', label:t('Coach adaptatif','Adaptive coach'), color:C.violet, bg:`${C.violet}12` },
              { emoji:'🏆', label:'A1 → C2',           color:C.coral,  bg:`${C.coral}12`  },
            ].map(({ emoji, label, color, bg }) => (
              <div key={label} style={{
                background:C.white, border:`1.5px solid ${C.border}`, borderRadius:16,
                padding:'14px 8px', textAlign:'center', boxShadow:'0 2px 10px rgba(28,43,58,0.05)',
              }}>
                <div style={{ fontSize:24, marginBottom:5 }}>{emoji}</div>
                <div style={{ fontSize:11, fontWeight:800, color, background:bg, borderRadius:6, padding:'2px 4px', display:'inline-block' }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Lives + XP preview */}
          <div style={{
            display:'flex', alignItems:'center', justifyContent:'center', gap:10,
            background:C.white, border:`1.5px solid ${C.border}`, borderRadius:14,
            padding:'10px 20px', marginBottom:18,
          }}>
            <span style={{ fontSize:12, fontWeight:700, color:C.muted }}>{t('Vies :','Lives:')}</span>
            <Hearts lives={MAX_LIVES} />
            <span style={{ color:C.border, fontWeight:300 }}>|</span>
            <Zap size={14} color={C.gold} fill={C.gold} />
            <span style={{ fontSize:12, fontWeight:800, color:C.dark }}>0 XP</span>
          </div>

          {error && (
            <div style={{ background:'#FEF0EE', border:'1.5px solid #F5C6C2', borderRadius:12, padding:'10px 14px', fontSize:12.5, fontWeight:700, color:'#A83228', marginBottom:14 }}>
              {error}
            </div>
          )}

          {/* CTA */}
          <button onClick={handleStart} disabled={phase === 'loading'} style={{
            width:'100%', padding:'15px', borderRadius:14,
            border:'none', borderBottom:`3px solid ${C.pinkDark}`,
            background:C.pink, color:'white',
            fontFamily:'Nunito,sans-serif', fontWeight:900, fontSize:15,
            cursor: phase === 'loading' ? 'not-allowed' : 'pointer',
            opacity: phase === 'loading' ? 0.65 : 1,
            display:'flex', alignItems:'center', justifyContent:'center', gap:9,
            boxShadow:`0 6px 22px ${C.pink}40`, transition:'all .2s',
          }}>
            {phase === 'loading'
              ? <><Loader2 size={17} style={{ animation:'spin 1s linear infinite' }} />{t('Préparation…','Preparing…')}</>
              : <><Mic size={17} />{t('Commencer le test','Start the test')}<ArrowRight size={15} /></>}
          </button>

          <p style={{ textAlign:'center', marginTop:11, fontSize:11, color:C.muted }}>
            ⏱ {t('~10 minutes · Gratuit · Sans inscription','~10 minutes · Free · No sign-up')}
          </p>
        </div>
      </div>
    </AppLayout>
  );

  /* ══════════════════════════════════════════════════════════════════════
     RESULT
  ══════════════════════════════════════════════════════════════════════ */
  if (phase === 'result' && result) {
    const level = (result.final_level || 'B1').toUpperCase();
    const lc    = LEVEL_COLORS[level] || LEVEL_COLORS.B1;
    const ld    = ldMap[level] || { label:'Level', emoji:'🎯', desc:'' };
    const avg   = result.score || 0;

    return (
      <AppLayout title={t('Résultats','Results')}>
        <style>{css}</style>
        <div style={{ maxWidth:440, margin:'0 auto', padding:'24px 16px 64px', fontFamily:"'Plus Jakarta Sans',Nunito,sans-serif" }}>

          {/* Header confetti */}
          <div style={{ textAlign:'center', marginBottom:14, animation:'pop .45s ease' }}>
            <div style={{ fontSize:50, marginBottom:6, lineHeight:1 }}>🎉</div>
            <h1 style={{ fontFamily:'Nunito,sans-serif', fontWeight:900, fontSize:24, color:C.dark, marginBottom:4 }}>
              {t('Test terminé !', 'Test complete!')}
            </h1>
            <div style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
              <Zap size={14} color={C.gold} fill={C.gold} />
              <span style={{ fontSize:13, fontWeight:700, color:C.mid }}>{t(`${xp} XP gagnés`,`${xp} XP earned`)}</span>
            </div>
          </div>

          {/* Level badge */}
          <div style={{
            borderRadius:24, padding:'30px 22px', textAlign:'center', marginBottom:12,
            background:`linear-gradient(145deg,${lc.g0},${lc.g1})`,
            boxShadow:`0 18px 50px ${lc.glow}`, animation:'pop .5s ease',
          }}>
            <div style={{ fontSize:42, marginBottom:10 }}>{ld.emoji}</div>
            <div style={{
              display:'inline-flex', alignItems:'center', justifyContent:'center',
              width:80, height:80, borderRadius:22, marginBottom:12,
              background:'rgba(255,255,255,.22)', border:'2.5px solid rgba(255,255,255,.3)',
            }}>
              <span style={{ color:'white', fontFamily:'Nunito,sans-serif', fontWeight:900, fontSize:34 }}>{level}</span>
            </div>
            <p style={{ color:'white', fontFamily:'Nunito,sans-serif', fontWeight:900, fontSize:20, marginBottom:4 }}>{ld.label}</p>
            <p style={{ color:'rgba(255,255,255,.82)', fontSize:13, marginBottom:16 }}>{ld.desc}</p>
            <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(255,255,255,.2)', borderRadius:999, padding:'8px 18px' }}>
              <Trophy size={14} color="white" />
              <span style={{ color:'white', fontWeight:800, fontSize:13 }}>{t('Score moyen','Avg score')} {avg}/100</span>
            </div>
          </div>

          {/* Feedback */}
          {result.feedback && (
            <div style={{ background:C.white, border:`1.5px solid ${C.border}`, borderRadius:18, padding:'18px', marginBottom:12, boxShadow:'0 2px 12px rgba(28,43,58,0.06)' }}>
              <p style={{ fontSize:'0.62rem', fontWeight:800, color:C.muted, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:8 }}>✨ {t('Bilan','Summary')}</p>
              <p style={{ fontSize:13.5, color:C.dark, lineHeight:1.65 }}>{result.feedback}</p>
            </div>
          )}

          {/* Strengths / Weaknesses */}
          {(result.strengths?.length > 0 || result.weaknesses?.length > 0) && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
              {result.strengths?.length > 0 && (
                <div style={{ background:'#EDFCF5', border:'1.5px solid #22C55E20', borderRadius:16, padding:'14px 12px' }}>
                  <p style={{ fontSize:9, fontWeight:800, color:'#15803D', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:8 }}>✅ {t('Points forts','Strengths')}</p>
                  {result.strengths.slice(0,4).map((s,i) => <p key={i} style={{ fontSize:11.5, color:C.dark, lineHeight:1.4, marginBottom:3 }}>• {s}</p>)}
                </div>
              )}
              {result.weaknesses?.length > 0 && (
                <div style={{ background:'#FEF2F2', border:'1.5px solid #EF444420', borderRadius:16, padding:'14px 12px' }}>
                  <p style={{ fontSize:9, fontWeight:800, color:'#DC2626', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:8 }}>📚 {t('À améliorer','To improve')}</p>
                  {result.weaknesses.slice(0,4).map((s,i) => <p key={i} style={{ fontSize:11.5, color:C.dark, lineHeight:1.4, marginBottom:3 }}>• {s}</p>)}
                </div>
              )}
            </div>
          )}

          {/* Sounds grid */}
          {history.length > 0 && (
            <div style={{ background:C.white, border:`1.5px solid ${C.border}`, borderRadius:18, padding:'18px', marginBottom:12 }}>
              <p style={{ fontSize:'0.62rem', fontWeight:800, color:C.muted, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:12 }}>{t('Sons testés','Sounds tested')}</p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:7 }}>
                {history.map((h, i) => {
                  const col = h.score>=75?C.tealDeep:h.score>=55?C.violet:C.pink;
                  const bg  = h.score>=75?'#EDFCF5':h.score>=55?'#F0EDFF':'#FEF2F2';
                  return (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:10, borderRadius:10, padding:'8px 10px', background:bg }}>
                      <span style={{ fontFamily:'Nunito,sans-serif', fontWeight:900, fontSize:14, color:col, minWidth:28 }}>{h.score}</span>
                      <span style={{ fontSize:11, color:C.dark, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{h.sound}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Révision sons difficiles — affiché si au moins un son < 70 */}
          {history.some(h => h.score < 70) && (
            <div style={{ background:'linear-gradient(135deg,#F0F9FF,#E0F2FE)', border:'1.5px solid #80DCDC55', borderRadius:18, padding:'18px', marginBottom:12 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                <div style={{ width:38, height:38, borderRadius:10, background:'linear-gradient(135deg,#80DCDC,#4DBFBF)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.2rem', flexShrink:0 }}>🔊</div>
                <div>
                  <p style={{ fontFamily:'Nunito,sans-serif', fontWeight:900, color:C.dark, fontSize:14, margin:0 }}>
                    {t('Sons à retravailler','Sounds to practise')}
                  </p>
                  <p style={{ fontSize:11, color:C.mid, margin:0 }}>
                    {history.filter(h => h.score < 70).length} son{history.filter(h => h.score < 70).length > 1 ? 's' : ''} {t('inscrits en révision espacée','enrolled in spaced repetition')}
                  </p>
                </div>
              </div>
              <Link to="/exercises/revision?tab=sounds" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'white', borderRadius:12, padding:'12px 14px', textDecoration:'none', border:'1.5px solid #80DCDC44' }}>
                <span style={{ display:'flex', alignItems:'center', gap:7, fontWeight:800, fontSize:13, color:'#0284C7' }}>
                  🎯 {t('Commencer la révision phonétique','Start phonetic revision')}
                </span>
                <ChevronRight size={14} color="#0284C7" />
              </Link>
            </div>
          )}

          {/* Unlock CTA */}
          {unlocked && (
            <div style={{ borderRadius:20, padding:'20px', background:`linear-gradient(135deg,${lc.g0},${lc.g1})`, marginBottom:12 }}>
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
                <CheckCircle size={22} color="white" />
                <div>
                  <p style={{ fontFamily:'Nunito,sans-serif', fontWeight:900, color:'white', fontSize:14 }}>{t('Parcours déverrouillé !','Learning path unlocked!')}</p>
                  <p style={{ fontSize:11, color:'rgba(255,255,255,.75)' }}>{t(`Niveau ${level} activé`,`Level ${level} activated`)}</p>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <Link to="/courses" style={{ borderRadius:12, padding:'12px', display:'flex', alignItems:'center', justifyContent:'space-between', textDecoration:'none', background:'white', color:lc.text }}>
                  <span style={{ display:'flex', alignItems:'center', gap:6, fontWeight:700, fontSize:13 }}><GraduationCap size={13}/>{t('Cours','Courses')}</span>
                  <ChevronRight size={12} />
                </Link>
                <Link to="/exercises" style={{ borderRadius:12, padding:'12px', display:'flex', alignItems:'center', justifyContent:'space-between', textDecoration:'none', background:'white', color:lc.text }}>
                  <span style={{ display:'flex', alignItems:'center', gap:6, fontWeight:700, fontSize:13 }}><BookOpen size={13}/>{t('Exercices','Exercises')}</span>
                  <ChevronRight size={12} />
                </Link>
              </div>
            </div>
          )}

          {/* ── Progression chart ───────────────────────────────────────── */}
          {progression && progression.count >= 2 && (() => {
            const sessions = progression.sessions;
            const W = 340, H = 90, PAD = 24;
            const scores = sessions.map(s => s.score);
            const minS = Math.max(0,  Math.min(...scores) - 10);
            const maxS = Math.min(100, Math.max(...scores) + 10);
            const xStep = (W - PAD*2) / (sessions.length - 1);
            const yScale = v => H - PAD - ((v - minS) / (maxS - minS)) * (H - PAD*2);
            const pts = sessions.map((s,i) => `${PAD + i*xStep},${yScale(s.score)}`).join(' ');
            const improvement = progression.improvement;
            const impColor = improvement > 0 ? '#22C55E' : improvement < 0 ? '#EF4444' : C.mid;
            const impSign  = improvement > 0 ? '+' : '';
            return (
              <div style={{ background:C.white, border:`1.5px solid ${C.border}`, borderRadius:18, padding:'16px 18px', marginBottom:12 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                  <p style={{ fontSize:'0.62rem', fontWeight:800, color:C.muted, textTransform:'uppercase', letterSpacing:'0.1em', margin:0 }}>
                    📈 {t('Progression','Score progression')}
                  </p>
                  <div style={{ display:'flex', gap:14 }}>
                    <span style={{ fontSize:11, fontWeight:700, color:C.mid }}>{t('Meilleur','Best')} <b style={{color:C.tealDeep}}>{progression.best_score}</b></span>
                    <span style={{ fontSize:11, fontWeight:700, color:impColor }}>{impSign}{improvement} pts</span>
                  </div>
                </div>
                <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow:'visible' }}>
                  <defs>
                    <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.teal} stopOpacity="0.25"/>
                      <stop offset="100%" stopColor={C.teal} stopOpacity="0"/>
                    </linearGradient>
                  </defs>
                  {/* Fill area */}
                  <polygon
                    points={`${PAD},${H-PAD} ${pts} ${PAD+(sessions.length-1)*xStep},${H-PAD}`}
                    fill="url(#lineGrad)"
                  />
                  {/* Line */}
                  <polyline points={pts} fill="none" stroke={C.tealDark} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>
                  {/* Dots + labels */}
                  {sessions.map((s,i) => {
                    const cx = PAD + i*xStep, cy = yScale(s.score);
                    const isLast = i === sessions.length-1;
                    return (
                      <g key={i}>
                        <circle cx={cx} cy={cy} r={isLast?5:3.5} fill={isLast?C.tealDeep:C.teal} stroke="white" strokeWidth="1.5"/>
                        {isLast && <text x={cx} y={cy-9} textAnchor="middle" fontSize="10" fontWeight="800" fill={C.tealDeep}>{s.score}</text>}
                        {i===0 && <text x={cx} y={cy-9} textAnchor="middle" fontSize="10" fontWeight="700" fill={C.mid}>{s.score}</text>}
                      </g>
                    );
                  })}
                </svg>
                <p style={{ fontSize:10.5, color:C.muted, textAlign:'center', margin:'4px 0 0' }}>
                  {sessions.length} {t('tests complétés','tests completed')} · {t('Dernier niveau','Latest level')} <b style={{color:C.dark}}>{sessions[sessions.length-1]?.level}</b>
                </p>
              </div>
            );
          })()}

          <button onClick={resetAll} style={{
            width:'100%', padding:'12px', background:'none', border:'none', cursor:'pointer',
            fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.1em',
            display:'flex', alignItems:'center', justifyContent:'center', gap:7,
          }}>
            <RotateCcw size={11}/>{t('Refaire le test','Redo the test')}
          </button>
        </div>
      </AppLayout>
    );
  }

  /* ══════════════════════════════════════════════════════════════════════
     TESTING + FEEDBACK
  ══════════════════════════════════════════════════════════════════════ */
  const isFeedback = phase === 'feedback';
  const scoreCol   = lastScore != null ? (lastScore>=75?C.tealDeep:lastScore>=55?C.violet:C.pink) : C.violet;
  const scoreBg    = lastScore != null ? (lastScore>=75?'#EDFCF5':lastScore>=55?'#F0EDFF':'#FEF2F2') : '#F9FAFB';
  const scoreEmoji = lastScore != null ? (lastScore>=75?'🎉':lastScore>=55?'👍':'💪') : '';
  const scoreMsg   = lastScore != null ? (lastScore>=75?t('Excellent !','Excellent!'):lastScore>=55?t('Bien joué !','Well done!'):t('Continue !','Keep going!')) : '';

  return (
    <AppLayout title={t('Test de Niveau','Level Test')}>
      <style>{css}</style>
      <div style={{ maxWidth:460, margin:'0 auto', padding:'20px 16px 56px', position:'relative', fontFamily:"'Plus Jakarta Sans',Nunito,sans-serif" }}>

        {/* XP pop */}
        {xpAnim && (
          <div style={{
            position:'fixed', top:'40%', left:'50%', transform:'translate(-50%,-50%)',
            pointerEvents:'none', zIndex:9999,
            fontFamily:'Nunito,sans-serif', fontWeight:900, fontSize:26, color:C.gold,
            animation:'xpFly .9s ease forwards', textShadow:`0 2px 12px ${C.gold}80`,
          }}>
            +{xpAnim} XP ⚡
          </div>
        )}

        {/* ── Top bar ──────────────────────────────────────────────────── */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
          <button onClick={() => setConfirmQuit(true)} style={{
            width:34, height:34, borderRadius:'50%', background:C.white, border:`1.5px solid ${C.border}`,
            cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:C.muted, flexShrink:0,
          }}>
            <X size={13} />
          </button>
          <div style={{ flex:1, height:9, background:'#E8E4DF', borderRadius:999, overflow:'hidden' }}>
            <div style={{
              height:'100%', borderRadius:999, transition:'width .7s ease',
              background:`linear-gradient(90deg,${C.teal},${C.tealDark})`,
              width:`${((step-1)/TOTAL_STEPS)*100}%`,
            }} />
          </div>
          <span style={{ fontSize:11, fontWeight:900, color:C.dark, fontFamily:'Nunito,sans-serif', flexShrink:0 }}>
            {step}<span style={{ opacity:.4 }}>/{TOTAL_STEPS}</span>
          </span>
        </div>

        {/* ── Hearts + XP ──────────────────────────────────────────────── */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
          <Hearts lives={lives} />
          <div style={{ display:'flex', alignItems:'center', gap:5 }}>
            <Zap size={13} color={C.gold} fill={C.gold} />
            <span style={{ fontFamily:'Nunito,sans-serif', fontWeight:900, fontSize:13, color:C.dark }}>{xp} XP</span>
          </div>
        </div>

        {/* ── Step dots ────────────────────────────────────────────────── */}
        <div style={{ marginBottom:12 }}>
          <StepDots step={step} total={TOTAL_STEPS} history={history} />
        </div>

        {/* ── Sound + level chips ──────────────────────────────────────── */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginBottom:12, flexWrap:'wrap' }}>
          <span style={{
            display:'inline-flex', alignItems:'center', gap:6, borderRadius:999,
            padding:'6px 14px', fontSize:12, fontWeight:800,
            background:`${C.teal}16`, color:C.tealDeep, border:`1.5px solid ${C.teal}30`,
          }}>
            🎯 {soundLabel}
          </span>
          <span style={{
            display:'inline-flex', alignItems:'center', gap:5, borderRadius:999,
            padding:'6px 12px', fontSize:12, fontWeight:600, color:C.mid,
            background:C.white, border:`1.5px solid ${C.border}`,
          }}>
            <TrendingUp size={10}/> {t('Niveau estimé','Est. level')} <strong style={{ color:C.dark }}>{estLevel}</strong>
          </span>
        </div>

        {/* ── Main card ────────────────────────────────────────────────── */}
        <div style={{
          background:C.white, border:`1.5px solid ${C.border}`, borderRadius:24,
          overflow:'hidden', marginBottom:12, boxShadow:'0 4px 22px rgba(28,43,58,0.07)',
        }}>
          {/* FEEDBACK phase */}
          {isFeedback && lastScore !== null ? (
            <div style={{ animation:'fadeUp .35s ease' }}>
              <div style={{ padding:'28px 24px', textAlign:'center', background:scoreBg }}>
                <div style={{ fontSize:40, marginBottom:6, lineHeight:1 }}>{scoreEmoji}</div>
                <AnimatedScore target={lastScore} />
                <p style={{ fontFamily:'Nunito,sans-serif', fontWeight:900, fontSize:16, marginTop:7, color:scoreCol }}>{scoreMsg}</p>
              </div>
              {/* ── Feedback texte (quick → remplacé par LLM) ── */}
              {lastFeedback && (
                <div style={{
                  margin:'0 16px 4px', borderRadius:14,
                  border:`1.5px solid ${scoreCol}22`,
                  background: lastScore >= 75 ? '#EDFCF5' : lastScore >= 55 ? '#F0EDFF' : '#FEF2F2',
                  padding:'14px 16px',
                }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                    <p style={{ fontSize:'.6rem', fontWeight:800, color:scoreCol, textTransform:'uppercase', letterSpacing:'.1em', margin:0 }}>
                      🤖 {t('Feedback personnalisé','Personalized feedback')}
                    </p>
                    {llmLoading && (
                      <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:10, color:C.muted, fontWeight:700 }}>
                        <Loader2 size={11} style={{ animation:'spin 1s linear infinite' }} />
                        {t('Analyse…','Analysing…')}
                      </div>
                    )}
                  </div>
                  <p style={{ fontSize:13, color:C.dark, lineHeight:1.7, fontWeight:500 }}>
                    {userName ? lastFeedback.replace(/\bAlex\b/gi, userName) : lastFeedback}
                  </p>
                </div>
              )}

              {/* ── Analyse mot-à-mot : SUB + DEL uniquement (erreurs réelles) ── */}
              {analyzeData?.ops?.some(op => op.op === 'SUB' || op.op === 'DEL') && (
                <div style={{ margin:'4px 16px 4px', borderRadius:12, border:`1px solid ${C.border}`, padding:'12px 14px', background:C.white }}>
                  <p style={{ fontSize:'.58rem', fontWeight:900, color:C.muted, textTransform:'uppercase', letterSpacing:'.12em', marginBottom:8 }}>
                    🔤 {t('Mots à corriger','Words to correct')}
                  </p>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                    {analyzeData.ops
                      .filter(op => op.op === 'SUB' || op.op === 'DEL')
                      .map((op, i) => {
                        const ipaEntry = analyzeData.phonemes?.word_phonemes?.find(
                          p => p.word?.toLowerCase() === (op.expected || '').toLowerCase()
                        );
                        const colMap = { SUB: C.coral, DEL: '#E8476A' };
                        const bgMap  = { SUB: '#FFF7F0', DEL: '#FDE8EE' };
                        return (
                          <div key={i} style={{
                            display:'flex', flexDirection:'column', alignItems:'center',
                            padding:'5px 9px', borderRadius:9,
                            background: bgMap[op.op],
                            border:`1.5px solid ${colMap[op.op]}33`,
                          }}>
                            <span style={{ fontSize:12, fontWeight:700, color: colMap[op.op] }}>
                              {op.op === 'SUB' ? `${op.expected} → ${op.got}` : `[${op.expected}]`}
                            </span>
                            {ipaEntry?.ipa && (
                              <span style={{ fontSize:9, fontFamily:'monospace', color:'#38bdf8', marginTop:2, letterSpacing:'.3px' }}>
                                /{ipaEntry.ipa}/
                              </span>
                            )}
                            <span style={{ fontSize:8.5, color:C.muted, marginTop:1, fontWeight:700, letterSpacing:'.5px' }}>
                              {op.op === 'SUB' ? t('mal dit','wrong') : t('omis','missed')}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* ── Sons IPA difficiles (G2P, si pas de ops) ── */}
              {!analyzeData?.ops?.some(op => op.op !== 'OK') &&
               analyzeData?.phonemes?.word_phonemes?.some(p => p.issue) && (
                <div style={{ margin:'4px 16px 4px', borderRadius:12, border:`1px solid ${C.border}`, padding:'11px 14px', background:C.white }}>
                  <p style={{ fontSize:'.58rem', fontWeight:900, color:C.muted, textTransform:'uppercase', letterSpacing:'.12em', marginBottom:8 }}>
                    🔬 {t('Sons à surveiller','Sounds to watch')}
                  </p>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
                    {analyzeData.phonemes.word_phonemes.filter(p => p.issue).map((p, i) => (
                      <div key={i} style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'5px 9px', borderRadius:9, background:'#FFF7F0', border:`1.5px solid ${C.coral}33` }}>
                        <span style={{ fontSize:12, fontWeight:700, color:C.coral }}>{p.word}</span>
                        <span style={{ fontSize:9, fontFamily:'monospace', color:'#38bdf8', marginTop:2 }}>/{p.ipa}/</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ padding:'0 20px 20px' }}>
                <button
                  onClick={handleContinue}
                  disabled={waitingNext && !nextData}
                  style={{
                    width:'100%', padding:'14px', borderRadius:14,
                    border:'none', borderBottom:`3px solid ${C.pinkDark}`,
                    background: C.pink,
                    color:'white', fontFamily:'Nunito,sans-serif', fontWeight:900, fontSize:14,
                    cursor: 'pointer',
                    display:'flex', alignItems:'center', justifyContent:'center', gap:8, transition:'all .2s',
                    boxShadow: `0 4px 16px ${C.pink}35`,
                    opacity: (waitingNext && !nextData) ? 0.75 : 1,
                  }}>
                  {(waitingNext && !nextData)
                    ? <><Loader2 size={15} style={{ animation:'spin 1s linear infinite' }}/>{t('Un instant…','Just a sec…')}</>
                    : <>{t('Continuer','Continue')} <ArrowRight size={15}/></>}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Phrase */}
              <div style={{ padding:'28px 24px 18px', textAlign:'center' }}>
                <p style={{ fontSize:'0.58rem', fontWeight:900, color:C.muted, textTransform:'uppercase', letterSpacing:'0.15em', marginBottom:12 }}>
                  {t('Prononce cette phrase','Pronounce this phrase')}
                </p>
                {/* Decorative bar */}
                <div style={{ width:38, height:3, background:`linear-gradient(90deg,${C.teal},${C.coral})`, borderRadius:999, margin:'0 auto 14px' }} />
                <p style={{ fontFamily:'Nunito,sans-serif', fontWeight:900, color:C.dark, fontSize:20, lineHeight:1.45 }}>
                  "{phrase}"
                </p>
              </div>

              {/* Tip */}
              {instruction && (
                <div style={{ borderTop:`1px solid ${C.border}` }}>
                  <button onClick={() => setShowTip(v => !v)} style={{
                    width:'100%', padding:'10px 20px', background:'none', border:'none', cursor:'pointer',
                    display:'flex', alignItems:'center', justifyContent:'space-between',
                    fontSize:12, fontWeight:700, color:C.mid,
                  }}>
                    <span>💡 {t('Conseil de prononciation','Pronunciation tip')}</span>
                    <span>{showTip ? '▲' : '▼'}</span>
                  </button>
                  {showTip && (
                    <div style={{ padding:'0 20px 14px' }}>
                      <p style={{ fontSize:12, color:C.mid, lineHeight:1.6 }}>{instruction}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Error */}
              {error && (
                <div style={{ margin:'0 16px 12px', background:'#FEF0EE', border:'1.5px solid #F5C6C2', borderRadius:10, padding:'10px 14px', fontSize:12, fontWeight:700, color:'#A83228' }}>
                  {error}
                </div>
              )}

              {/* Mic zone */}
              <div style={{ padding:'4px 20px 24px', display:'flex', flexDirection:'column', alignItems:'center', gap:14 }}>

                {recState === 'idle' && (
                  <>
                    <button onClick={handleStartRec} style={{
                      width:88, height:88, borderRadius:'50%',
                      background:`linear-gradient(145deg,${C.teal},${C.tealDeep})`,
                      border:'none', cursor:'pointer',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      animation:'rippleTeal 2.2s ease-in-out infinite',
                    }}>
                      <Mic size={40} color="white" strokeWidth={1.6} />
                    </button>
                    <p style={{ fontSize:12, fontWeight:700, color:C.muted }}>
                      {t('Appuie sur le micro pour parler','Tap the mic to speak')}
                    </p>
                  </>
                )}

                {recState === 'recording' && (
                  <>
                    <button onClick={handleStopRec} style={{
                      width:88, height:88, borderRadius:'50%',
                      background:`linear-gradient(145deg,${C.pink},${C.pinkDark})`,
                      border:'none', cursor:'pointer',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      animation:'ripplePink 1.1s ease-in-out infinite',
                    }}>
                      <div style={{ width:30, height:30, background:'white', borderRadius:8 }} />
                    </button>
                    <p style={{ fontSize:12, fontWeight:700, color:C.pink }}>
                      {t('Enregistrement… Appuie pour arrêter','Recording… Tap to stop')}
                    </p>
                  </>
                )}

                {recState === 'recorded' && (
                  <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:10 }}>
                    {audioUrl && <audio controls src={audioUrl} style={{ width:'100%', borderRadius:12, height:40 }} />}
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                      <button onClick={handleReRecord} style={{
                        padding:'13px', borderRadius:12, background:C.bg,
                        border:`1.5px solid ${C.border}`, cursor:'pointer',
                        fontFamily:'Nunito,sans-serif', fontWeight:800, fontSize:13, color:C.dark,
                      }}>
                        🔄 {t('Refaire','Redo')}
                      </button>
                      <button onClick={handleSubmit} style={{
                        padding:'13px', borderRadius:12,
                        background:C.teal, border:'none', borderBottom:`2px solid ${C.tealDark}`,
                        cursor:'pointer', color:'white',
                        fontFamily:'Nunito,sans-serif', fontWeight:900, fontSize:13,
                        boxShadow:`0 4px 14px ${C.teal}45`,
                      }}>
                        ✓ {t('Valider','Submit')}
                      </button>
                    </div>
                  </div>
                )}

                {recState === 'processing' && (
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:14, padding:'24px 16px' }}>
                    <div style={{
                      width:58, height:58, borderRadius:'50%',
                      background:`linear-gradient(145deg,${C.teal},${C.tealDeep})`,
                      boxShadow:`0 6px 22px ${C.teal}40`,
                      display:'flex', alignItems:'center', justifyContent:'center',
                    }}>
                      <Loader2 size={25} color="white" style={{ animation:'spin 1s linear infinite' }} />
                    </div>
                    <div style={{ textAlign:'center' }}>
                      <p style={{ fontSize:13, fontWeight:800, color:C.dark, margin:0 }}>
                        {t('Analyse en cours…','Analysing your voice…')}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Quit confirm ─────────────────────────────────────────────── */}
        {confirmQuit && (
          <div style={{
            background:C.white, border:`1.5px solid ${C.border}`, borderRadius:20, padding:'22px',
            textAlign:'center', boxShadow:'0 6px 24px rgba(28,43,58,0.12)', animation:'fadeUp .3s ease',
          }}>
            <p style={{ fontFamily:'Nunito,sans-serif', fontWeight:900, color:C.dark, fontSize:15, marginBottom:5 }}>
              {t('Quitter le test ?','Quit the test?')}
            </p>
            <p style={{ fontSize:12.5, color:C.muted, marginBottom:18 }}>
              {t('Ta progression sera sauvegardée partiellement.','Your partial progress will be saved.')}
            </p>
            <div style={{ display:'flex', gap:8, justifyContent:'center' }}>
              <button onClick={() => setConfirmQuit(false)} style={{
                padding:'10px 24px', borderRadius:11, border:`1.5px solid ${C.border}`,
                background:C.bg, cursor:'pointer', fontWeight:700, fontSize:13, color:C.dark,
              }}>
                {t('Continuer','Continue')}
              </button>
              <button onClick={handleQuit} style={{
                padding:'10px 24px', borderRadius:11, border:'none', borderBottom:`2px solid ${C.pinkDark}`,
                background:C.pink, cursor:'pointer', fontWeight:900, fontSize:13, color:'white',
              }}>
                {t('Quitter','Quit')}
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
