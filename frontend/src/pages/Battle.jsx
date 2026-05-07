import { useState, useRef, useEffect, useCallback } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { createBattle, joinBattle, getBattle, submitBattleScore, getMyBattles, analyzeBattleAudio } from '../api/battle';
import { recordErrors } from '../api/spacedRepetition';
import api from '../api/axios';
import { Swords, Copy, Check, Mic, Loader2, Zap, User, RotateCcw } from 'lucide-react';

const C = {
  violet: '#9580D4', violetDark: '#7D66C0', violetSoft: '#F3F0FE',
  teal: '#80DCDC', tealDark: '#4DBFBF', tealSoft: '#E8F9F9',
  coral: '#E8926A', coralDark: '#D47A52',
  rose: '#E8476A', roseSoft: '#FDE8EE',
  gold: '#F0C85A', goldDark: '#B89B30',
  dark: '#1C2B3A', mid: '#5F7183', border: '#EEE8E0', white: '#FFFFFF',
};

const UI = {
  fr: {
    title: 'Mode Battle',
    subtitle: 'Défiez un autre apprenant sur 3 phrases !',
    createTab: 'Créer une battle', joinTab: 'Rejoindre',
    createBtn: 'Créer la battle',
    levelLabel: 'Niveau', langLabel: 'Langue',
    shareCode: 'Partage ce code avec ton adversaire :',
    copied: 'Copié !', copy: 'Copier',
    waitingOpponent: 'En attente de l\'adversaire…',
    waitingHint: 'Donne le code à ton ami et attends qu\'il rejoigne.',
    joinCode: 'Code de battle (6 caractères)',
    joinBtn: 'Rejoindre la battle',
    phrase: 'PHRASE À PRONONCER',
    record: 'Appuie pour enregistrer',
    recording: '🔴 Enregistrement…',
    analyze: '✓ Analyser',
    reRecord: '↺ Recommencer',
    analyzing: 'Analyse en cours…',
    waitingOpponentScore: 'En attente du score adverse…',
    you: 'Toi',
    opponent: 'Adversaire',
    winner: '🏆 Gagnant !',
    tie: '🤝 Égalité !',
    loser: '💪 Continue !',
    playAgain: 'Nouvelle battle',
    vs: 'VS',
    scoreLabel: '/100',
    noCode: 'Entre le code de la battle.',
    errNotFound: 'Battle introuvable. Vérifie le code.',
    errJoin: 'Impossible de rejoindre cette battle.',
    shortRec: 'Enregistrement trop court. Reparle.',
  },
  en: {
    title: 'Battle Mode',
    subtitle: 'Challenge another learner on 3 phrases!',
    createTab: 'Create battle', joinTab: 'Join',
    createBtn: 'Create battle',
    levelLabel: 'Level', langLabel: 'Language',
    shareCode: 'Share this code with your opponent:',
    copied: 'Copied!', copy: 'Copy',
    waitingOpponent: 'Waiting for opponent…',
    waitingHint: 'Give the code to your friend and wait for them to join.',
    joinCode: 'Battle code (6 characters)',
    joinBtn: 'Join battle',
    phrase: 'PHRASE TO PRONOUNCE',
    record: 'Press to record',
    recording: '🔴 Recording…',
    analyze: '✓ Analyze',
    reRecord: '↺ Re-record',
    analyzing: 'Analyzing…',
    waitingOpponentScore: 'Waiting for opponent\'s score…',
    you: 'You',
    opponent: 'Opponent',
    winner: '🏆 Winner!',
    tie: '🤝 Tie!',
    loser: '💪 Keep going!',
    playAgain: 'New battle',
    vs: 'VS',
    scoreLabel: '/100',
    noCode: 'Enter the battle code.',
    errNotFound: 'Battle not found. Check the code.',
    errJoin: 'Could not join this battle.',
    shortRec: 'Recording too short. Speak again.',
  },
};

// ── Composants helpers ────────────────────────────────────────────────────────

function ScoreRing({ score, size = 80 }) {
  const r = 34, circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = score >= 70 ? C.teal : score >= 45 ? C.coral : C.rose;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#F3F4F6" strokeWidth="7" />
        <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="7"
          strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 40 40)" />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontWeight: 900, fontSize: size > 70 ? '1.3rem' : '1rem', color, lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: '0.5rem', fontWeight: 700, color: C.mid }}>pts</span>
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function Battle() {
  const { lang } = useLanguage();
  const { user } = useAuth();
  const ui = UI[lang] || UI.fr;

  const [tab,           setTab]          = useState('create');
  const [level,         setLevel]        = useState('B1');
  const [battleLang,    setBattleLang]   = useState(lang);
  const [joinCode,      setJoinCode]     = useState('');
  const [battle,        setBattle]       = useState(null);
  const [phase,         setPhase]        = useState('lobby');
  const [error,         setError]        = useState('');
  const [loading,       setLoading]      = useState(false);
  const [copied,        setCopied]       = useState(false);
  const [myScore,       setMyScore]      = useState(null);
  const [myRoundScores, setMyRoundScores]= useState([]);
  const [roundScore,    setRoundScore]   = useState(null);
  const [audioUrl,      setAudioUrl]     = useState(null);
  const [myBattles,     setMyBattles]    = useState([]);
  const [duration,      setDuration]     = useState(0);
  const capturedBlob = useRef(null);
  const pollRef      = useRef(null);
  const timerRef     = useRef(null);

  const { isRecording, startRecording, stopRecording, resetRecording } = useAudioRecorder();

  const myEmail = user?.email || '';

  // ── Charger les battles actives de l'utilisateur au montage ──────────────
  useEffect(() => {
    getMyBattles().then(res => setMyBattles(res.data || [])).catch(() => {});
  }, []);

  const phaseRef = useRef(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // ── Polling du statut battle ──────────────────────────────────────────────
  const startPolling = useCallback((code) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await getBattle(code);
        const b   = res.data;
        setBattle(b);
        
        const currentPhase = phaseRef.current;
        
        if (currentPhase === 'waiting' && b.status === 'ACTIVE') {
          setPhase('intro'); // Show VS intro
          setTimeout(() => setPhase('recording'), 2500);
          clearInterval(pollRef.current);
        }
        
        if (b.status === 'FINISHED') {
          clearInterval(pollRef.current);
          setPhase('result');
        }
      } catch { /* ignore */ }
    }, 2500);
  }, []);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // ── Créer battle ──────────────────────────────────────────────────────────
  const handleCreate = async () => {
    setLoading(true); setError('');
    try {
      const res = await createBattle(battleLang, level);
      setBattle(res.data);
      setPhase('waiting');
      startPolling(res.data.code);
    } catch { setError('Erreur lors de la création.'); }
    setLoading(false);
  };

  // ── Rejoindre battle ──────────────────────────────────────────────────────
  const handleJoin = async () => {
    if (!joinCode.trim()) { setError(ui.noCode); return; }
    setLoading(true); setError('');
    try {
      const res = await joinBattle(joinCode.trim());
      if (res.data.error) { setError(ui.errNotFound); setLoading(false); return; }
      setBattle(res.data);
      setPhase('recording');
    } catch (err) {
      if (err?.response?.status === 409) {
        setError(lang === 'fr' ? 'Cette battle est déjà complète ou tu en es le créateur.' : 'This battle is already full or you created it.');
      } else if (err?.response?.status === 404) {
        setError(ui.errNotFound);
      } else {
        setError(ui.errJoin);
      }
    }
    setLoading(false);
  };

  // ── Enregistrement ────────────────────────────────────────────────────────
  const handleStartRec = async () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null); capturedBlob.current = null;
    setError('');
    setDuration(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setDuration(d => d + 0.1);
    }, 100);
    await startRecording();
    setPhase('recording');
  };

  const handleStopRec = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    const blob = await stopRecording();
    if (!blob || blob.size < 500) { setError(ui.shortRec); return; }
    capturedBlob.current = blob;
    setAudioUrl(URL.createObjectURL(blob));
    setPhase('recorded');
  };

  const handleReRecord = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null); capturedBlob.current = null;
    resetRecording(); setPhase('recording'); setError('');
  };

  // ── Analyser + soumettre score ────────────────────────────────────────────
  const handleAnalyze = async () => {
    if (!capturedBlob.current || !battle) return;
    setPhase('analyzing');
    try {
      const r = await analyzeBattleAudio(capturedBlob.current, battle.phrase, battle.lang, battle.level);
      const data = r.data;

      if (data.stt_error) { setError('Audio non reconnu. Réessaie.'); setPhase('recorded'); return; }

      let score = Math.round((data.word_diff_score ?? 0) * 0.6 + (data.avg_confidence ?? 0) * 100 * 0.4);
      const weakCount  = data.phonemes?.weak_phonemes?.length ?? 0;
      const totalCount = data.phonemes?.word_phonemes?.length || 1;
      score = Math.max(0, score - Math.round((weakCount / totalCount) * 20));

      const newRoundScores = [...myRoundScores, score];
      setMyRoundScores(newRoundScores);
      setRoundScore(score);
      setMyScore(score);

      const missedWords = (data.ops || [])
        .filter(op => op.op === 'SUB' || op.op === 'DEL')
        .map(op => ({ word: op.expected, level: battle.level || level }));
      if (missedWords.length > 0) recordErrors(missedWords).catch(() => {});

      const masterSid = localStorage.getItem('masterSessionId');
      if (masterSid) {
        api.post('/api/master/turn', {
          session_id:     masterSid,
          mode:           'EXERCISE',
          score_input:    score,
          lang:           battle.lang,
          phoneme_errors: missedWords.map(w => w.word),
        }).catch(() => {});
      }

      const subRes = await submitBattleScore(battle.code, score);
      const updated = subRes.data;
      setBattle(updated);

      if (updated.status === 'FINISHED') {
        setPhase('result');
      } else if (newRoundScores.length >= (updated.totalRounds || 5)) {
        // I finished all my rounds, waiting for opponent to finish theirs
        setPhase('waitingScore');
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(async () => {
          try {
            const res = await getBattle(battle.code);
            setBattle(res.data);
            if (res.data.status === 'FINISHED') {
              clearInterval(pollRef.current);
              setPhase('result');
            }
          } catch { /* ignore */ }
        }, 3000);
      } else {
        // More rounds remaining — show brief round feedback then go to next phrase
        setPhase('roundFeedback');
        setTimeout(() => {
          if (audioUrl) URL.revokeObjectURL(audioUrl);
          setAudioUrl(null);
          capturedBlob.current = null;
          resetRecording();
          setRoundScore(null);
          setPhase('recording');
        }, 2200);
      }
    } catch (e) {
      setError(`Erreur : ${e.message}`);
      setPhase('recorded');
    }
  };

  // ── Copier le code ────────────────────────────────────────────────────────
  const copyCode = () => {
    if (!battle?.code) return;
    navigator.clipboard.writeText(battle.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const reset = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setBattle(null); setPhase('lobby'); setError('');
    setMyScore(null); setMyRoundScores([]); setRoundScore(null);
    setAudioUrl(null); capturedBlob.current = null;
    resetRecording();
  };

  const handleRematch = async () => {
    if (!battle) return;
    const oldBattle = battle;
    setLoading(true);
    try {
      // Create a new battle with same settings
      const res = await createBattle(oldBattle.lang, oldBattle.level);
      const newB = res.data;
      setBattle(newB);
      setPhase('waiting');
      startPolling(newB.code);
    } catch (err) {
      setError("Erreur lors de la création de la revanche.");
    }
    setLoading(false);
  };

  // Calcul résultat
  const isCreator          = battle?.isCreator;
  const myScoreFinal       = battle ? (isCreator ? battle.creatorScore : battle.challengerScore) : myScore;
  const oppScoreFinal      = battle ? (isCreator ? battle.challengerScore : battle.creatorScore) : null;
  const myRoundsFinal      = battle ? (isCreator ? battle.creatorRoundScores  : battle.challengerRoundScores) : myRoundScores;
  const oppRoundsFinal     = battle ? (isCreator ? battle.challengerRoundScores : battle.creatorRoundScores) : [];
  const winner        = battle?.winner;
  const iWon   = winner && winner !== 'TIE' && winner === myEmail;
  const isTie  = winner === 'TIE';

  return (
    <AppLayout title={ui.title}>
      <style>{`
        @keyframes pulse-ring{0%{transform:scale(1);opacity:.7}70%{transform:scale(1.2);opacity:0}100%{opacity:0}}
        @keyframes bounce-in{0%{transform:scale(0.7);opacity:0}70%{transform:scale(1.1)}100%{transform:scale(1);opacity:1}}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
        @keyframes vs-slide-left {0%{transform:translateX(-100px);opacity:0}100%{transform:translateX(0);opacity:1}}
        @keyframes vs-slide-right {0%{transform:translateX(100px);opacity:0}100%{transform:translateX(0);opacity:1}}
        @keyframes vs-scale {0%{transform:scale(0);opacity:0}50%{transform:scale(1.5);opacity:1}100%{transform:scale(1);opacity:1}}
      `}</style>

      <div style={{ maxWidth: 560, margin: '0 auto', paddingBottom: 60 }}>

        {/* ── Header ── */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: `linear-gradient(135deg,${C.violet},${C.violetDark})`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 8px 24px ${C.violet}40`, animation: 'float 3s ease-in-out infinite', marginBottom: 12 }}>
            <Swords style={{ width: 28, height: 28, color: 'white' }} />
          </div>
          <h1 style={{ fontWeight: 900, fontSize: '1.5rem', color: C.dark, margin: '0 0 6px' }}>{ui.title}</h1>
          <p style={{ fontWeight: 600, fontSize: '0.85rem', color: C.mid, margin: 0 }}>{ui.subtitle}</p>
        </div>

        {/* ── LOBBY ── */}
        {phase === 'lobby' && (
          <>
            {/* Tabs */}
            <div style={{ display: 'flex', background: '#F3F4F6', borderRadius: 14, padding: 4, marginBottom: 20 }}>
              {[{ k: 'create', l: ui.createTab }, { k: 'join', l: ui.joinTab }].map(t => (
                <button key={t.k} onClick={() => { setTab(t.k); setError(''); }}
                  style={{ flex: 1, padding: '10px', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: '0.88rem', cursor: 'pointer', transition: 'all .15s',
                    background: tab === t.k ? C.white : 'transparent',
                    color: tab === t.k ? C.violet : C.mid,
                    boxShadow: tab === t.k ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                  }}>
                  {t.l}
                </button>
              ))}
            </div>

            <div style={{ background: C.white, borderRadius: 20, border: `1.5px solid ${C.border}`, borderBottom: `4px solid ${C.border}`, padding: '1.5rem' }}>
              {tab === 'create' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontWeight: 700, fontSize: '0.72rem', color: C.mid, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{ui.levelLabel}</label>
                      <select value={level} onChange={e => setLevel(e.target.value)}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.border}`, background: C.white, fontWeight: 700, fontSize: '0.88rem', color: C.dark, cursor: 'pointer' }}>
                        {['A1','A2','B1','B2','C1','C2'].map(l => <option key={l}>{l}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontWeight: 700, fontSize: '0.72rem', color: C.mid, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{ui.langLabel}</label>
                      <select value={battleLang} onChange={e => setBattleLang(e.target.value)}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.border}`, background: C.white, fontWeight: 700, fontSize: '0.88rem', color: C.dark, cursor: 'pointer' }}>
                        <option value="fr">🇫🇷 Français</option>
                        <option value="en">🇬🇧 English</option>
                      </select>
                    </div>
                  </div>
                  <button onClick={handleCreate} disabled={loading}
                    style={{ padding: '13px', borderRadius: 12, border: 'none', background: `linear-gradient(135deg,${C.violet},${C.violetDark})`, color: 'white', fontWeight: 900, fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: `0 4px 0 ${C.violetDark}`, opacity: loading ? 0.7 : 1 }}>
                    {loading ? <Loader2 style={{ width: 18, height: 18, animation: 'spin 0.8s linear infinite' }} /> : <Swords style={{ width: 18, height: 18 }} />}
                    {ui.createBtn}
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontWeight: 700, fontSize: '0.72rem', color: C.mid, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{ui.joinCode}</label>
                    <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} maxLength={6}
                      placeholder="ABC123"
                      style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: `2px solid ${C.violet}`, background: C.white, fontWeight: 900, fontSize: '1.4rem', letterSpacing: '0.3em', color: C.violet, textAlign: 'center', boxSizing: 'border-box', outline: 'none' }} />
                  </div>
                  <button onClick={handleJoin} disabled={loading}
                    style={{ padding: '13px', borderRadius: 12, border: 'none', background: `linear-gradient(135deg,${C.coral},${C.coralDark})`, color: 'white', fontWeight: 900, fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: `0 4px 0 ${C.coralDark}`, opacity: loading ? 0.7 : 1 }}>
                    {loading ? <Loader2 style={{ width: 18, height: 18, animation: 'spin 0.8s linear infinite' }} /> : <Zap style={{ width: 18, height: 18 }} />}
                    {ui.joinBtn}
                  </button>
                </div>
              )}
              {error && <p style={{ marginTop: 10, fontWeight: 700, fontSize: '0.82rem', color: C.rose }}>{error}</p>}
            </div>

            {/* ── Mes battles actives ── */}
            {myBattles.length > 0 && (
              <div style={{ marginTop: 20, background: C.white, borderRadius: 20, border: `1.5px solid ${C.border}`, borderBottom: `4px solid ${C.border}`, padding: '1.25rem' }}>
                <p style={{ fontWeight: 800, fontSize: '0.78rem', color: C.mid, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                  {lang === 'fr' ? '⚔️ Mes battles en attente' : '⚔️ My pending battles'}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {myBattles.map(b => (
                    <div key={b.code} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: C.violetSoft, borderRadius: 12, padding: '10px 14px' }}>
                      <div>
                        <span style={{ fontWeight: 900, fontSize: '1.1rem', color: C.violet, letterSpacing: '0.15em' }}>{b.code}</span>
                        <span style={{ marginLeft: 10, fontSize: '0.75rem', color: C.mid, fontWeight: 600 }}>{b.level} · {b.lang === 'fr' ? '🇫🇷' : '🇬🇧'}</span>
                      </div>
                      <button
                        onClick={() => { setBattle(b); setPhase(b.status === 'WAITING' ? 'waiting' : 'recording'); if (b.status === 'WAITING') startPolling(b.code); }}
                        style={{ padding: '7px 16px', borderRadius: 10, border: 'none', background: C.violet, color: 'white', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer' }}>
                        {lang === 'fr' ? 'Rejoindre' : 'Rejoin'}
                      </button>
                    </div>
                  ))}
                </div>
                <p style={{ marginTop: 10, fontSize: '0.7rem', color: C.mid, fontWeight: 600 }}>
                  ⏱ {lang === 'fr' ? 'Les battles expirent après 30 minutes.' : 'Battles expire after 30 minutes.'}
                </p>
              </div>
            )}
          </>
        )}

        {/* ── INTRO VS ── */}
        {phase === 'intro' && (
          <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 30, overflow: 'hidden' }}>
            <div style={{ textAlign: 'center', animation: 'vs-slide-left 0.6s ease-out' }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: C.violet, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', boxShadow: `0 8px 20px ${C.violet}44` }}>👤</div>
              <p style={{ fontWeight: 900, marginTop: 10, color: C.dark }}>{user?.firstName || 'Moi'}</p>
            </div>
            <div style={{ fontSize: '3rem', fontWeight: 950, fontStyle: 'italic', color: C.rose, animation: 'vs-scale 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}>VS</div>
            <div style={{ textAlign: 'center', animation: 'vs-slide-right 0.6s ease-out' }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: C.coral, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', boxShadow: `0 8px 20px ${C.coral}44` }}>👤</div>
              <p style={{ fontWeight: 900, marginTop: 10, color: C.dark }}>{ui.opponent}</p>
            </div>
          </div>
        )}

        {/* ── WAITING (créateur attend l'adversaire) ── */}
        {phase === 'waiting' && battle && (
          <div style={{ background: C.white, borderRadius: 20, border: `1.5px solid ${C.border}`, borderBottom: `4px solid ${C.border}`, padding: '2rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12, animation: 'float 2s ease-in-out infinite' }}>⚔️</div>
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontWeight: 700, fontSize: '0.8rem', color: C.mid, marginBottom: 8 }}>{ui.shareCode}</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <span style={{ fontWeight: 900, fontSize: '2.2rem', letterSpacing: '0.25em', color: C.violet }}>{battle.code}</span>
                <button onClick={copyCode}
                  style={{ width: 36, height: 36, borderRadius: 10, border: `1.5px solid ${C.violet}`, background: C.violetSoft, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.violet }}>
                  {copied ? <Check style={{ width: 16, height: 16 }} /> : <Copy style={{ width: 16, height: 16 }} />}
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: C.mid, marginBottom: 16 }}>
              <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
              <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>{ui.waitingOpponent}</span>
            </div>
            <p style={{ fontWeight: 600, fontSize: '0.72rem', color: C.mid, marginBottom: 16 }}>{ui.waitingHint}</p>
            <button onClick={reset}
              style={{ padding: '9px 20px', borderRadius: 10, border: `1.5px solid ${C.border}`, background: C.white, fontWeight: 700, fontSize: '0.82rem', color: C.mid, cursor: 'pointer' }}>
              {lang === 'en' ? 'Cancel' : 'Annuler'}
            </button>
          </div>
        )}

        {/* ── RECORDING ── */}
        {(phase === 'recording' || phase === 'recorded') && battle && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Round progress */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {Array.from({ length: battle.totalRounds || 5 }).map((_, i) => (
                <div key={i} style={{
                  width: i === myRoundScores.length ? 28 : 10,
                  height: 10,
                  borderRadius: 99,
                  background: i < myRoundScores.length ? C.teal : i === myRoundScores.length ? C.violet : '#E5E7EB',
                  transition: 'all 0.3s',
                }} />
              ))}
              <span style={{ fontWeight: 800, fontSize: '0.75rem', color: C.mid, marginLeft: 6 }}>
                {myRoundScores.length + 1} / {battle.totalRounds || 5}
              </span>
            </div>

            {/* Phrase card */}
            <div style={{ background: `linear-gradient(135deg,${C.violetSoft},${C.white})`, borderRadius: 20, border: `2px solid ${C.violet}30`, padding: '1.5rem', textAlign: 'center' }}>
              <p style={{ fontWeight: 900, fontSize: '0.65rem', color: C.violet, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>{ui.phrase}</p>
              <p style={{ fontWeight: 900, fontSize: '1.3rem', color: C.dark, lineHeight: 1.5, margin: 0 }}>"{battle.phrase}"</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12 }}>
                <span style={{ fontWeight: 700, fontSize: '0.72rem', color: C.mid, background: '#F3F4F6', borderRadius: 99, padding: '2px 10px' }}>{battle.level}</span>
                <span style={{ fontWeight: 700, fontSize: '0.72rem', color: C.mid, background: '#F3F4F6', borderRadius: 99, padding: '2px 10px' }}>{battle.lang === 'fr' ? '🇫🇷 FR' : '🇬🇧 EN'}</span>
              </div>
            </div>

            {/* Micro — isRecording (hook) drives button state, not phase */}
            <div style={{ background: C.white, borderRadius: 20, border: `1.5px solid ${C.border}`, borderBottom: `4px solid ${C.border}`, padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
              {phase === 'recording' && (
                isRecording ? (
                  <button onClick={handleStopRec}
                    style={{ width: 80, height: 80, borderRadius: '50%', border: 'none', background: `linear-gradient(135deg,${C.rose},#c8305a)`, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 0 12px ${C.rose}20, 0 8px 24px ${C.rose}50`, animation: 'pulse-ring 1.4s ease-out infinite' }}>
                    <Mic style={{ width: 32, height: 32 }} />
                  </button>
                ) : (
                  <button onClick={handleStartRec}
                    style={{ width: 80, height: 80, borderRadius: '50%', border: 'none', background: `linear-gradient(135deg,${C.violet},${C.violetDark})`, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 8px 24px ${C.violet}40` }}>
                    <Mic style={{ width: 32, height: 32 }} />
                  </button>
                )
              )}
              <p style={{ fontWeight: 700, fontSize: '0.82rem', color: C.mid, margin: 0 }}>
                {isRecording ? `${ui.recording} (${duration.toFixed(1)}s)` : ui.record}
              </p>
              {phase === 'recorded' && audioUrl && (
                <audio controls src={audioUrl} style={{ width: '100%', borderRadius: 10 }} />
              )}
              {phase === 'recorded' && (
                <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                  <button onClick={handleReRecord}
                    style={{ flex: 1, padding: '11px', borderRadius: 12, border: `2px solid ${C.border}`, background: C.white, fontWeight: 800, fontSize: '0.86rem', color: C.mid, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <RotateCcw style={{ width: 14, height: 14 }} /> {ui.reRecord}
                  </button>
                  <button onClick={handleAnalyze}
                    style={{ flex: 2, padding: '11px', borderRadius: 12, border: 'none', background: `linear-gradient(135deg,${C.teal},${C.tealDark})`, fontWeight: 900, fontSize: '0.92rem', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, boxShadow: `0 4px 0 ${C.tealDark}` }}>
                    <Zap style={{ width: 15, height: 15 }} /> {ui.analyze}
                  </button>
                </div>
              )}
            </div>
            {error && <p style={{ fontWeight: 700, fontSize: '0.82rem', color: C.rose, textAlign: 'center' }}>{error}</p>}
          </div>
        )}

        {/* ── ANALYZING ── */}
        {phase === 'analyzing' && (
          <div style={{ background: C.white, borderRadius: 20, border: `1.5px solid ${C.border}`, padding: '3rem', textAlign: 'center' }}>
            <Loader2 style={{ width: 40, height: 40, color: C.teal, animation: 'spin 0.8s linear infinite', marginBottom: 12 }} />
            <p style={{ fontWeight: 800, fontSize: '1rem', color: C.dark }}>{ui.analyzing}</p>
          </div>
        )}

        {/* ── ROUND FEEDBACK ── */}
        {phase === 'roundFeedback' && battle && (
          <div style={{ background: C.white, borderRadius: 20, border: `1.5px solid ${C.border}`, borderBottom: `4px solid ${C.teal}`, padding: '2.5rem', textAlign: 'center', animation: 'bounce-in 0.4s ease' }}>
            <p style={{ fontWeight: 900, fontSize: '0.7rem', color: C.teal, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>
              {lang === 'fr' ? `Round ${myRoundScores.length} terminé !` : `Round ${myRoundScores.length} done!`}
            </p>
            <div style={{ display: 'inline-block', marginBottom: 14 }}>
              <ScoreRing score={roundScore ?? 0} size={100} />
            </div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 14 }}>
              {Array.from({ length: battle.totalRounds || 5 }).map((_, i) => (
                <div key={i} style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: i < myRoundScores.length ? C.teal : '#E5E7EB',
                }} />
              ))}
            </div>
            <p style={{ fontWeight: 700, fontSize: '0.8rem', color: C.mid }}>
              {lang === 'fr'
                ? `Total : ${myRoundScores.reduce((a, b) => a + b, 0)} pts — Round suivant…`
                : `Total: ${myRoundScores.reduce((a, b) => a + b, 0)} pts — Next round…`}
            </p>
          </div>
        )}

        {/* ── WAITING OPPONENT SCORE ── */}
        {phase === 'waitingScore' && (
          <div style={{ background: C.white, borderRadius: 20, border: `1.5px solid ${C.border}`, padding: '2.5rem', textAlign: 'center', animation: 'bounce-in 0.5s ease' }}>
            <p style={{ fontWeight: 900, fontSize: '0.7rem', color: C.teal, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>
              {lang === 'fr' ? '✓ Tes 5 rounds terminés !' : '✓ All 5 rounds done!'}
            </p>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'inline-block', position: 'relative' }}>
                <ScoreRing score={myRoundScores.reduce((a, b) => a + b, 0)} size={100} />
                <div style={{ position: 'absolute', top: -5, right: -5, background: C.teal, color: 'white', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 900, boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}>✓</div>
              </div>
              <p style={{ fontWeight: 800, fontSize: '0.9rem', color: C.dark, marginTop: 10 }}>
                {ui.you} : {myRoundScores.reduce((a, b) => a + b, 0)} pts
              </p>
            </div>
            {/* Per-round scores */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
              {myRoundScores.map((s, i) => (
                <div key={i} style={{ textAlign: 'center' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: s >= 70 ? C.tealSoft : s >= 45 ? '#FFF3EE' : C.roseSoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontWeight: 900, fontSize: '0.75rem', color: s >= 70 ? C.tealDark : s >= 45 ? C.coralDark : C.rose }}>{s}</span>
                  </div>
                  <span style={{ fontSize: '0.6rem', color: C.mid, fontWeight: 700 }}>R{i + 1}</span>
                </div>
              ))}
            </div>
            <div style={{ background: C.violetSoft, borderRadius: 16, padding: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <Loader2 style={{ width: 18, height: 18, color: C.violet, animation: 'spin 2s linear infinite' }} />
              <div>
                <p style={{ fontWeight: 800, fontSize: '0.88rem', color: C.violet, margin: 0 }}>{ui.opponent} ...</p>
                <p style={{ fontWeight: 600, fontSize: '0.7rem', color: C.mid, margin: 0 }}>{lang === 'fr' ? "En attente de l'adversaire" : "Waiting for opponent"}</p>
              </div>
            </div>
          </div>
        )}

        {/* ── RESULT ── */}
        {phase === 'result' && battle && (
          <div style={{ animation: 'bounce-in 0.5s ease both' }}>
            {/* Banner gagnant/perdant */}
            <div style={{ borderRadius: 20, padding: '1.5rem', textAlign: 'center', marginBottom: 14, background: iWon ? `linear-gradient(135deg,${C.gold},${C.goldDark})` : isTie ? `linear-gradient(135deg,#6BACD4,#4A90BD)` : `linear-gradient(135deg,${C.coral},${C.coralDark})`, color: 'white', boxShadow: `0 8px 24px ${iWon ? C.gold : isTie ? '#6BACD4' : C.coral}50` }}>
              <div style={{ fontSize: '3rem', marginBottom: 8 }}>{iWon ? '🏆' : isTie ? '🤝' : '💪'}</div>
              <p style={{ fontWeight: 900, fontSize: '1.4rem', margin: 0 }}>
                {iWon ? ui.winner : isTie ? ui.tie : ui.loser}
              </p>
            </div>

            {/* Scores */}
            <div style={{ background: C.white, borderRadius: 20, border: `1.5px solid ${C.border}`, borderBottom: `4px solid ${C.border}`, padding: '1.5rem', marginBottom: 14, position: 'relative' }}>
              
              {/* Speed Bonus Badge */}
              <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', background: C.teal, color: 'white', padding: '4px 12px', borderRadius: 20, fontSize: '0.7rem', fontWeight: 900, boxShadow: '0 4px 10px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Zap style={{ width: 10, height: 10 }} /> {lang === 'fr' ? 'Réponse éclair' : 'Flash response'}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: 20 }}>
                <div style={{ textAlign: 'center' }}>
                  <ScoreRing score={myScoreFinal ?? 0} size={88} />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 8 }}>
                    <User style={{ width: 13, height: 13, color: C.violet }} />
                    <span style={{ fontWeight: 800, fontSize: '0.8rem', color: C.dark }}>{ui.you}</span>
                  </div>
                </div>
                <div style={{ fontWeight: 900, fontSize: '1.6rem', color: C.mid }}>{ui.vs}</div>
                <div style={{ textAlign: 'center', opacity: oppScoreFinal == null ? 0.4 : 1 }}>
                  <ScoreRing score={oppScoreFinal ?? 0} size={88} />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 8 }}>
                    <Swords style={{ width: 13, height: 13, color: C.coral }} />
                    <span style={{ fontWeight: 800, fontSize: '0.8rem', color: C.dark }}>{ui.opponent}</span>
                  </div>
                </div>
              </div>

              {/* Per-round breakdown */}
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px dashed ${C.border}` }}>
                <p style={{ fontWeight: 700, fontSize: '0.65rem', color: C.mid, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10, textAlign: 'center' }}>
                  {lang === 'fr' ? 'Détail par round' : 'Round breakdown'}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {Array.from({ length: battle.totalRounds || 5 }).map((_, i) => {
                    const ms = myRoundsFinal?.[i];
                    const os = oppRoundsFinal?.[i];
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 800, fontSize: '0.7rem', color: C.mid, width: 52 }}>
                          {lang === 'fr' ? `Round ${i + 1}` : `Round ${i + 1}`}
                        </span>
                        <div style={{ flex: 1, height: 6, borderRadius: 99, background: '#F3F4F6', overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 99, width: `${ms ?? 0}%`, background: C.violet, transition: 'width 0.6s' }} />
                        </div>
                        <span style={{ fontWeight: 900, fontSize: '0.78rem', color: C.violet, width: 28, textAlign: 'right' }}>{ms ?? '—'}</span>
                        <span style={{ fontWeight: 700, fontSize: '0.7rem', color: C.mid }}>vs</span>
                        <span style={{ fontWeight: 900, fontSize: '0.78rem', color: C.coral, width: 28 }}>{os ?? '—'}</span>
                        <div style={{ flex: 1, height: 6, borderRadius: 99, background: '#F3F4F6', overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 99, width: `${os ?? 0}%`, background: C.coral, transition: 'width 0.6s' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={reset}
                style={{ flex: 1, padding: '14px', borderRadius: 14, border: `2px solid ${C.border}`, background: C.white, fontWeight: 800, fontSize: '0.9rem', color: C.mid, cursor: 'pointer', transition: 'all 0.2s' }}>
                {lang === 'fr' ? 'Retour' : 'Back'}
              </button>
              <button onClick={handleRematch} disabled={loading}
                style={{ flex: 2, padding: '14px', borderRadius: 14, border: 'none', background: `linear-gradient(135deg,${C.violet},${C.violetDark})`, color: 'white', fontWeight: 900, fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: `0 4px 0 ${C.violetDark}`, opacity: loading ? 0.7 : 1 }}>
                {loading ? <Loader2 style={{ width: 18, height: 18, animation: 'spin 0.8s linear infinite' }} /> : <RotateCcw style={{ width: 18, height: 18 }} />}
                {lang === 'fr' ? 'Revanche !' : 'Rematch!'}
              </button>
            </div>
          </div>
        )}

      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </AppLayout>
  );
}
