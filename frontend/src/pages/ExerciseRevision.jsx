import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
import Layout from '../components/layout/Layout';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { getDueItems, getSoundsDue, markReviewed } from '../api/spacedRepetition';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Volume2, Trophy, ArrowRight } from 'lucide-react';
import api from '../api/axios';

// ── Static word→emoji map (no LLM needed) ────────────────────────────────────
const WORD_EMOJI = {
  // FR
  bonjour:'👋',merci:'🙏',maison:'🏠',chat:'🐱',chien:'🐶',eau:'💧',
  pain:'🍞',café:'☕',voiture:'🚗',école:'🏫',livre:'📚',fleur:'🌸',
  soleil:'☀️',lune:'🌙',arbre:'🌳',pomme:'🍎',famille:'👨‍👩‍👧',ami:'🤝',
  travail:'💼',musique:'🎵',ville:'🏙️',rue:'🛣️',porte:'🚪',fenêtre:'🪟',
  table:'🪑',chaise:'🪑',lit:'🛏️',temps:'⏰',jour:'📅',nuit:'🌙',
  matin:'🌅',soir:'🌆',année:'📆',homme:'👨',femme:'👩',enfant:'👶',
  père:'👨',mère:'👩',frère:'👦',sœur:'👧',grand:'📏',petit:'🔬',
  beau:'✨',bien:'✅',mal:'❌',vrai:'✔️',faux:'✖️',vie:'💚',
  monde:'🌍',pays:'🗺️',langue:'🗣️',mot:'💬',phrase:'📝',son:'🔊',
  lettre:'✉️',chiffre:'🔢',couleur:'🎨',rouge:'🔴',bleu:'🔵',vert:'🟢',
  blanc:'⬜',noir:'⬛',nombre:'🔢',argent:'💰',heure:'⌚',minute:'⏱️',
  seconde:'⚡',semaine:'📅',mois:'📆',voix:'🎤',oreille:'👂',oeil:'👁️',
  main:'✋',pied:'🦶',tête:'🧠',coeur:'❤️',bras:'💪',corps:'🧍',
  // EN
  hello:'👋',thank:'🙏',house:'🏠',cat:'🐱',dog:'🐶',water:'💧',
  bread:'🍞',coffee:'☕',car:'🚗',school:'🏫',book:'📚',flower:'🌸',
  sun:'☀️',moon:'🌙',tree:'🌳',apple:'🍎',family:'👨‍👩‍👧',friend:'🤝',
  work:'💼',music:'🎵',city:'🏙️',street:'🛣️',door:'🚪',window:'🪟',
  bed:'🛏️',time:'⏰',day:'📅',evening:'🌆',year:'📆',man:'👨',
  woman:'👩',child:'👶',father:'👨',mother:'👩',brother:'👦',sister:'👧',
  big:'📏',small:'🔬',good:'✅',bad:'❌',true:'✔️',love:'❤️',
  heart:'💖',star:'⭐',fire:'🔥',food:'🍽️',run:'🏃',walk:'🚶',
  speak:'🗣️',talk:'💬',listen:'👂',read:'📖',write:'✍️',think:'🤔',
  know:'🧠',word:'💬',sound:'🔊',color:'🎨',red:'🔴',blue:'🔵',
  green:'🟢',white:'⬜',black:'⬛',money:'💰',hand:'✋',eye:'👁️',
  head:'🧠',heart2:'❤️',arm:'💪',world:'🌍',language:'🗣️',voice:'🎤',
};

// Static sound → example words (no LLM) ──────────────────────────────────────
const SOUND_WORDS = {
  // French
  '/ʒ/':['je','jamais','déjà','joueur'],'/y/':['tu','lune','rue','vu'],
  '/ɥ/':['lui','nuit','puis','fruit'],'/ə/':['le','me','que','ce'],
  '/ɛ̃/':['vin','pain','bain','main'],'/ɑ̃/':['dans','temps','sang','vent'],
  '/ɔ̃/':['bon','non','pont','long'],'/œ/':['peu','feu','veux','yeux'],
  '/r/':['rouge','rue','rêve','arbre'],'ou':['nous','vous','tout','roue'],
  'u':['tu','lune','rue','vu'],'eu':['peu','feu','veux','yeux'],
  'on':['bon','non','pont','long'],'in':['vin','pain','bain','fin'],
  'an':['dans','temps','grand','vent'],'en':['vent','temps','gens','bien'],
  'oi':['moi','toi','voix','bois'],'ui':['lui','nuit','puis','fruit'],
  'gn':['montagne','ligne','gagner'],'ill':['fille','maille','briller'],
  // English
  '/θ/':['think','three','through','thick'],'/ð/':['this','that','they','them'],
  '/æ/':['cat','bad','hat','man'],'/ʌ/':['cup','sun','but','run'],
  '/ŋ/':['sing','king','ring','long'],'/w/':['we','want','work','word'],
  'th':['think','the','there','three'],'wh':['what','where','when','which'],
  'sh':['ship','shop','show','share'],'ch':['chair','church','child','choose'],
};

function getSoundWord(sound) {
  const words = SOUND_WORDS[sound];
  if (words && words.length > 0) return words[Math.floor(Math.random() * words.length)];
  return sound;
}

function getWordEmoji(word) {
  return WORD_EMOJI[(word || '').toLowerCase().replace(/[.,!?]/g, '')] || null;
}

// ── Score ring SVG ────────────────────────────────────────────────────────────
function ScoreRing({ score, size = 72 }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 70 ? '#22C55E' : score >= 50 ? '#F59E0B' : '#EF4444';
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#F3F4F6" strokeWidth={8} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={8}
        strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: 'stroke-dasharray .8s ease' }} />
      <text x="50%" y="54%" textAnchor="middle" dominantBaseline="middle"
        fontSize={size * 0.24} fontWeight="900" fill={color}>{score}</text>
    </svg>
  );
}

// ── Score compute (no LLM, pure math) ────────────────────────────────────────
function computeResult(data, lang) {
  let score = 0;
  if (!data.stt_error) {
    score = Math.round((data.word_diff_score ?? 0) * 0.6 + (data.avg_confidence ?? 0) * 100 * 0.4);
    const weakCount = data.phonemes?.weak_phonemes?.length ?? 0;
    const totalCount = data.phonemes?.word_phonemes?.length || 1;
    score = Math.max(0, score - Math.round((weakCount / totalCount) * 20));
  }
  const en = lang === 'en';
  const feedback = data.feedback || (
    score >= 85 ? (en ? 'Perfect! Spot on.' : 'Parfait ! Impeccable.')
    : score >= 70 ? (en ? 'Excellent! Very clear.' : 'Excellent ! Très clair.')
    : score >= 55 ? (en ? 'Good. A bit more fluid.' : 'Bien. Un peu plus fluide.')
    : (en ? 'Keep practicing this word.' : 'Continue à pratiquer ce mot.')
  );
  return { ...data, score, feedback };
}

// ── i18n ──────────────────────────────────────────────────────────────────────
const T = {
  fr: {
    title:'Révision personnalisée',tabWords:'📝 Mots difficiles',tabSounds:'🔊 Sons phonétiques',
    back:'← Retour aux exercices',loading:'Chargement…',noWords:'Aucun mot à réviser !',
    noWordsDesc:'Fais des exercices ou le test de niveau pour ajouter des mots à réviser.',
    noSounds:'Aucun son à réviser !',noSoundsDesc:'Fais des exercices pour identifier tes sons difficiles.',
    wordsRevised:'Révision terminée !',soundsRevised:'Sons révisés !',
    pronounce:'Prononce ce mot',pronounceSound:'Prononce ce son',
    listen:'Écouter',speak:'Parler',stop:'Arrêter',analysing:'Analyse…',
    perfect:'🎉 Parfait !',excellent:'✨ Excellent !',good:'👍 Bien !',rework:'🔄 À retravailler',
    next:'Suivant →',finish:'Terminer',restart:'Recommencer',
    avgScore:'Score moyen',wordsDone:'mots révisés',soundsDone:'sons révisés',
    tooShort:'Trop court, réessaie.',networkError:'Erreur réseau.',
    goExercises:'Faire des exercices',progress:'Progression',
    hint:'Écoute d\'abord, puis prononce le mot',soundHint:'Écoute puis prononce ce son',
    examples:'Exemples',langFR:'🇫🇷 Français',langEN:'🇬🇧 Anglais',
    removed:'✅ Maîtrisé !',kept:'🔄 À revoir',
  },
  en: {
    title:'Personalised Revision',tabWords:'📝 Difficult words',tabSounds:'🔊 Phonetic sounds',
    back:'← Back to exercises',loading:'Loading…',noWords:'No words to revise!',
    noWordsDesc:'Do exercises or the level test to add words to revise.',
    noSounds:'No sounds to revise!',noSoundsDesc:'Do exercises to identify your difficult sounds.',
    wordsRevised:'Revision complete!',soundsRevised:'Sounds revised!',
    pronounce:'Pronounce this word',pronounceSound:'Pronounce this sound',
    listen:'Listen',speak:'Speak',stop:'Stop',analysing:'Analysing…',
    perfect:'🎉 Perfect!',excellent:'✨ Excellent!',good:'👍 Good!',rework:'🔄 Needs work',
    next:'Next →',finish:'Finish',restart:'Restart',
    avgScore:'Average score',wordsDone:'words revised',soundsDone:'sounds revised',
    tooShort:'Too short, try again.',networkError:'Network error.',
    goExercises:'Go to exercises',progress:'Progress',
    hint:'Listen first, then pronounce the word',soundHint:'Listen then pronounce this sound',
    examples:'Examples',langFR:'🇫🇷 French',langEN:'🇬🇧 English',
    removed:'✅ Mastered!',kept:'🔄 Keep practicing',
  }
};

// ── Global styles ─────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&display=swap');
  * { font-family: 'Nunito', sans-serif; box-sizing: border-box; }
  @keyframes bounceIn {
    0%   { transform: scale(0.4); opacity: 0; }
    60%  { transform: scale(1.1); opacity: 1; }
    100% { transform: scale(1); }
  }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
  @keyframes shake {
    0%,100%{transform:translateX(0)}
    20%,60%{transform:translateX(-10px)}
    40%,80%{transform:translateX(10px)}
  }
  @keyframes popSuccess {
    0%{transform:scale(1)} 40%{transform:scale(1.1)} 70%{transform:scale(0.97)} 100%{transform:scale(1)}
  }
  @keyframes recordPulse {
    0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.4)}
    50%{box-shadow:0 0 0 22px rgba(239,68,68,0)}
  }
  @keyframes slideUp {
    from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1}
  }
  @keyframes spin { to{transform:rotate(360deg)} }
`;

// ── Word color palette (deterministic by word) ────────────────────────────────
const PALETTE = ['#E8926A','#80DCDC','#9B59B6','#3498DB','#2ECC71','#E74C3C','#F39C12'];
function wordColor(word) { return PALETTE[(word || 'a').charCodeAt(0) % PALETTE.length]; }

// ── TAB: Word Revision (Duolingo-style, one word at a time) ───────────────────
function WordRevisionTab({ level, lang }) {
  const navigate = useNavigate();
  const t = T[lang] || T.fr;
  const [words, setWords]       = useState([]);
  const [current, setCurrent]   = useState(0);
  const [phase, setPhase]       = useState('loading');
  const [result, setResult]     = useState(null);
  const [results, setResults]   = useState([]);
  const [error, setError]       = useState(null);
  const [cardAnim, setCardAnim] = useState('');
  const [listened, setListened] = useState(false);
  const { isRecording, startRecording, stopRecording, resetRecording } = useAudioRecorder();

  useEffect(() => { loadWords(); }, [lang]);

  const loadWords = async () => {
    setPhase('loading'); setCurrent(0); setResults([]); setResult(null);
    let items = [];
    try {
      const res = await getDueItems();
      let due = res.data?.due || [];
      due = due.filter(i => !i.itemType || i.itemType === 'WORD');
      // Filter by language if data has lang property
      if (due.some(i => i.lang)) due = due.filter(i => !i.lang || i.lang === lang);
      items = due;
    } catch { /* ignore */ }

    // Merge master session error log
    const masterSid = localStorage.getItem('masterSessionId');
    if (masterSid) {
      try {
        const res = await api.get(`/api/master/session/${masterSid}/stats`);
        const errorLog = res.data?.error_log || [];
        const srSet = new Set(items.map(i => (i.word || '').toLowerCase()));
        const extras = errorLog
          .filter(w => w && !srSet.has(w.toLowerCase()))
          .map((w, idx) => ({ id: `master_${idx}`, word: w, itemType: 'WORD', fromMaster: true }));
        items = [...items, ...extras];
      } catch { /* ignore */ }
    }

    if (items.length === 0) { setWords([]); setPhase('done'); return; }
    setWords(items); setPhase('ready'); setListened(false);
  };

  const currentWord = words[current];
  const color = currentWord ? wordColor(currentWord.word) : '#E8926A';
  const emoji = currentWord ? getWordEmoji(currentWord.word) : null;
  const progressPct = words.length > 0 ? (current / words.length) * 100 : 0;

  const speakWord = () => {
    if (!currentWord) return;
    const u = new SpeechSynthesisUtterance(currentWord.word);
    u.lang = lang === 'fr' ? 'fr-FR' : 'en-US'; u.rate = 0.8;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    setListened(true);
  };

  const handleRecord = async () => {
    if (isRecording) {
      const blob = await stopRecording();
      if (!blob || blob.size < 50) { setError(t.tooShort); return; }
      setPhase('processing'); setError(null);
      const fd = new FormData();
      fd.append('file', blob, 'audio.webm');
      fd.append('expectedPhrase', currentWord.word);
      fd.append('lang', lang);
      fd.append('level', level);
      try {
        const res = await api.post('/api/exercises/analyze', fd);
        const data = computeResult(res.data, lang);
        // For short words (≤ 4 chars) Whisper may flag as silent — give a low score instead of blocking
        if (data.stt_error) {
          if (currentWord.word.length <= 4) {
            setResult({ ...data, score: 30, feedback: lang === 'fr' ? 'Parle plus lentement et distinctement.' : 'Speak slower and more clearly.' });
            setCardAnim('fail'); setTimeout(() => setCardAnim(''), 700);
            setPhase('result'); return;
          }
          setError(t.tooShort); setPhase('ready'); return;
        }
        setResult(data);
        const passed = data.score >= 70;
        setCardAnim(passed ? 'success' : 'fail');
        setTimeout(() => setCardAnim(''), 700);
        if (passed) {
          confetti({ particleCount: 80, spread: 55, origin: { y: 0.6 }, colors: ['#80DCDC','#E8926A','#22C55E'] });
          if (!String(currentWord.id).startsWith('master_')) markReviewed(currentWord.id).catch(() => {});
        }
        setPhase('result');
      } catch { setError(t.networkError); setPhase('ready'); }
    } else {
      setError(null); await startRecording(); setPhase('recording');
    }
  };

  const handleNext = () => {
    setResults(r => [...r, { word: currentWord.word, score: result?.score || 0 }]);
    resetRecording(); setResult(null); setError(null); setListened(false);
    const next = current + 1;
    if (next >= words.length) setPhase('done');
    else { setCurrent(next); setPhase('ready'); }
  };

  // ── Loading ──
  if (phase === 'loading') return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'40vh', gap:16 }}>
      <div style={{ fontSize:'3rem', animation:'pulse 1.5s ease infinite' }}>📚</div>
      <p style={{ fontWeight:800, color:'#9BB0C2', margin:0 }}>{t.loading}</p>
    </div>
  );

  // ── Done ──
  if (phase === 'done') {
    const avg = results.length > 0 ? Math.round(results.reduce((a,b) => a + b.score, 0) / results.length) : 0;
    const passed = results.filter(r => r.score >= 70).length;
    return (
      <div style={{ maxWidth:480, margin:'0 auto', animation:'slideUp 0.4s ease' }}>
        <div style={{ background:'linear-gradient(135deg,#E8926A,#D47A52)', borderRadius:28, padding:'40px 28px', color:'white', textAlign:'center', marginBottom:20 }}>
          <div style={{ fontSize:'4rem', marginBottom:12 }}>{results.length === 0 ? '✅' : avg >= 70 ? '🏆' : '💪'}</div>
          <h2 style={{ fontWeight:900, fontSize:'1.5rem', margin:'0 0 8px' }}>
            {results.length === 0 ? t.noWords : t.wordsRevised}
          </h2>
          {results.length > 0
            ? <p style={{ opacity:0.9, margin:0 }}>{passed}/{results.length} {t.wordsDone} · {t.avgScore}: <strong>{avg}/100</strong></p>
            : <p style={{ opacity:0.85, fontSize:'0.88rem', margin:'12px 0 0', lineHeight:1.6 }}>{t.noWordsDesc}</p>
          }
        </div>

        {results.length > 0 && (
          <div style={{ background:'white', borderRadius:20, border:'1.5px solid #F3F4F6', padding:'20px', marginBottom:16 }}>
            {results.map((r, i) => {
              const em = getWordEmoji(r.word);
              const c = wordColor(r.word);
              return (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom: i < results.length-1 ? '1px solid #F9FAFB' : 'none' }}>
                  <div style={{ width:40, height:40, borderRadius:12, background: em ? `${c}15` : `linear-gradient(135deg,${c},${c}88)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.3rem', color: em ? 'inherit' : 'white', fontWeight:900, flexShrink:0 }}>
                    {em || r.word[0].toUpperCase()}
                  </div>
                  <span style={{ flex:1, fontWeight:800, color:'#1C2B3A', fontSize:'1rem' }}>{r.word}</span>
                  <span style={{ fontSize:'0.7rem', fontWeight:700, color: r.score >= 70 ? '#15803D' : '#DC2626' }}>
                    {r.score >= 70 ? t.removed : t.kept}
                  </span>
                  <ScoreRing score={r.score} size={44} />
                </div>
              );
            })}
          </div>
        )}

        <div style={{ display:'flex', gap:10 }}>
          <button onClick={loadWords} style={{ flex:1, background:'#F9FAFB', border:'1.5px solid #F3F4F6', borderRadius:14, padding:'12px', fontWeight:800, cursor:'pointer', color:'#5F7183' }}>{t.restart}</button>
          {results.length === 0 && (
            <button onClick={() => navigate('/exercises')} style={{ flex:1, background:'linear-gradient(135deg,#E8926A,#D47A52)', border:'none', borderRadius:14, padding:'12px', fontWeight:800, cursor:'pointer', color:'white' }}>{t.goExercises}</button>
          )}
        </div>
      </div>
    );
  }

  if (!currentWord) return null;

  // ── Main card ──
  return (
    <div style={{ maxWidth:480, margin:'0 auto' }}>
      {/* Progress bar */}
      <div style={{ marginBottom:24 }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
          <span style={{ fontWeight:800, fontSize:'0.7rem', color:color, textTransform:'uppercase', letterSpacing:'0.08em' }}>{t.progress}</span>
          <span style={{ fontWeight:800, fontSize:'0.75rem', color:'#9BB0C2' }}>{current + 1} / {words.length}</span>
        </div>
        <div style={{ height:8, background:'#F3F4F6', borderRadius:999, overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${progressPct}%`, background:`linear-gradient(90deg,${color},${color}bb)`, borderRadius:999, transition:'width .5s' }} />
        </div>
      </div>

      {/* Word card */}
      <div key={currentWord.id} style={{
        background:'white', borderRadius:28, border:`2px solid ${color}25`,
        padding:'36px 24px', textAlign:'center', marginBottom:20,
        boxShadow:`0 12px 40px ${color}12`,
        animation: cardAnim === 'success' ? 'popSuccess 0.6s ease' : cardAnim === 'fail' ? 'shake 0.5s ease' : 'bounceIn 0.5s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        {/* Visual avatar */}
        <div style={{ display:'flex', justifyContent:'center', marginBottom:22 }}>
          <div style={{
            width:120, height:120, borderRadius:32, flexShrink:0,
            background: emoji ? `${color}12` : `linear-gradient(135deg,${color},${color}99)`,
            border:`3px solid ${color}25`,
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize: emoji ? '4rem' : '3.2rem', fontWeight:900,
            color: emoji ? 'inherit' : 'white',
            boxShadow:`0 8px 28px ${color}30`,
          }}>
            {emoji || currentWord.word[0].toUpperCase()}
          </div>
        </div>

        {/* Word */}
        <div style={{ fontWeight:900, fontSize:'2.6rem', color:'#1C2B3A', marginBottom:8, letterSpacing:'-0.5px', lineHeight:1.1 }}>
          {currentWord.word}
        </div>

        {/* Lang badge */}
        <div style={{ display:'inline-block', background:`${color}12`, color:color, borderRadius:8, padding:'3px 12px', fontSize:'0.7rem', fontWeight:800, marginBottom:20 }}>
          {lang === 'fr' ? t.langFR : t.langEN}
        </div>

        {/* Listen button */}
        <div>
          <button onClick={speakWord} style={{
            background: listened ? '#F0FDF4' : `${color}12`,
            border:`2px solid ${listened ? '#86EFAC' : color + '35'}`,
            borderRadius:16, padding:'10px 24px', cursor:'pointer',
            display:'inline-flex', alignItems:'center', gap:8,
            fontWeight:800, fontSize:'0.9rem', transition:'all 0.2s',
            color: listened ? '#15803D' : color,
          }}>
            <Volume2 style={{ width:18, height:18 }} />
            {t.listen} {listened ? '✓' : ''}
          </button>
        </div>
      </div>

      {/* Result card */}
      {phase === 'result' && result && (
        <div style={{ marginBottom:16, animation:'slideUp 0.35s ease' }}>
          <div style={{
            background: result.score >= 70 ? '#F0FDF4' : result.score >= 50 ? '#FFFBEB' : '#FEF2F2',
            border:`2px solid ${result.score >= 70 ? '#86EFAC' : result.score >= 50 ? '#FCD34D' : '#FCA5A5'}`,
            borderRadius:20, padding:'16px 20px', display:'flex', alignItems:'center', gap:14, marginBottom:12,
          }}>
            <ScoreRing score={result.score} size={72} />
            <div style={{ flex:1 }}>
              <p style={{ fontWeight:900, fontSize:'1.05rem', margin:'0 0 4px',
                color: result.score >= 70 ? '#15803D' : result.score >= 50 ? '#B45309' : '#DC2626' }}>
                {result.score >= 85 ? t.perfect : result.score >= 70 ? t.excellent : result.score >= 55 ? t.good : t.rework}
              </p>
              {result.feedback && <p style={{ fontSize:'0.78rem', color:'#5F7183', margin:0, lineHeight:1.5 }}>{result.feedback}</p>}
            </div>
          </div>
          <button onClick={handleNext} style={{
            width:'100%', background:`linear-gradient(135deg,${color},${color}cc)`,
            color:'white', border:'none', borderRadius:16, padding:'14px',
            fontWeight:900, fontSize:'1rem', cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            boxShadow:`0 4px 16px ${color}40`,
          }}>
            {current + 1 >= words.length
              ? <><Trophy style={{width:18,height:18}} /> {t.finish}</>
              : <>{t.next} <ArrowRight style={{width:18,height:18}} /></>}
          </button>
        </div>
      )}

      {/* Record button */}
      {(phase === 'ready' || phase === 'recording' || phase === 'processing') && (
        <div style={{ textAlign:'center' }}>
          {error && (
            <div style={{ background:'#FEF2F2', border:'1.5px solid #FCA5A5', borderRadius:12, padding:'8px 14px', marginBottom:12, color:'#DC2626', fontWeight:700, fontSize:'0.8rem' }}>
              {error}
            </div>
          )}
          <p style={{ fontWeight:700, fontSize:'0.8rem', color:'#9BB0C2', marginBottom:16 }}>{t.hint}</p>
          <button onClick={handleRecord} disabled={phase === 'processing'} style={{
            width:92, height:92, borderRadius:'50%', border:'none',
            cursor: phase === 'processing' ? 'default' : 'pointer',
            background: phase === 'recording' ? '#EF4444' : '#80DCDC',
            color:'white', fontSize:'2.2rem',
            boxShadow: phase === 'recording'
              ? '0 0 0 0 rgba(239,68,68,0.4)'
              : '0 8px 28px rgba(128,220,220,0.5)',
            animation: phase === 'recording' ? 'recordPulse 1.5s ease infinite' : 'none',
            transition:'background 0.2s, box-shadow 0.2s',
            display:'inline-flex', alignItems:'center', justifyContent:'center',
          }}>
            {phase === 'processing' ? '⏳' : phase === 'recording' ? '⏹' : '🎙️'}
          </button>
          <p style={{ fontWeight:700, fontSize:'0.76rem', color:'#5F7183', marginTop:10 }}>
            {phase === 'processing' ? t.analysing : phase === 'recording' ? t.stop : t.speak}
          </p>
        </div>
      )}
    </div>
  );
}

// ── TAB: Sound Revision (no LLM, static examples) ────────────────────────────
function SoundRevisionTab({ level, lang }) {
  const navigate = useNavigate();
  const t = T[lang] || T.fr;
  const [sounds, setSounds]     = useState([]);
  const [current, setCurrent]   = useState(0);
  const [phase, setPhase]       = useState('loading');
  const [result, setResult]     = useState(null);
  const [results, setResults]   = useState([]);
  const [error, setError]       = useState(null);
  const [cardAnim, setCardAnim] = useState('');
  const [practiceWord, setPracticeWord] = useState('');
  const { isRecording, startRecording, stopRecording, resetRecording } = useAudioRecorder();

  useEffect(() => {
    getSoundsDue().then(res => {
      let due = res.data?.sounds || [];
      if (due.some(s => s.lang)) due = due.filter(s => !s.lang || s.lang === lang);
      if (due.length === 0) { setPhase('done'); return; }
      setSounds(due);
      const label = due[0].soundLabel || due[0].soundKey || '';
      setPracticeWord(getSoundWord(label) || label);
      setPhase('ready');
    }).catch(() => { setSounds([]); setPhase('done'); });
  }, [lang]);

  const currentSound = sounds[current];
  const label = currentSound?.soundLabel || currentSound?.soundKey || '';
  const color = '#80DCDC';
  const progressPct = sounds.length > 0 ? (current / sounds.length) * 100 : 0;

  const speakIt = (text) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === 'fr' ? 'fr-FR' : 'en-US'; u.rate = 0.8;
    window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
  };

  const handleRecord = async () => {
    if (isRecording) {
      const blob = await stopRecording();
      if (!blob || blob.size < 100) { setError(t.tooShort); return; }
      setPhase('processing'); setError(null);
      const fd = new FormData();
      fd.append('file', blob, 'audio.webm');
      fd.append('expectedPhrase', practiceWord);
      fd.append('lang', lang); fd.append('level', level);
      try {
        const res = await api.post('/api/exercises/analyze', fd);
        const data = computeResult(res.data, lang);
        if (data.stt_error) { setError(t.tooShort); setPhase('ready'); return; }
        setResult(data);
        const passed = data.score >= 70;
        setCardAnim(passed ? 'success' : 'fail');
        setTimeout(() => setCardAnim(''), 700);
        if (passed && currentSound?.id) {
          confetti({ particleCount: 60, spread: 50, origin: { y: 0.6 }, colors: ['#80DCDC','#5BBFBF','#22C55E'] });
          markReviewed(currentSound.id).catch(() => {});
        }
        setPhase('result');
      } catch { setError(t.networkError); setPhase('ready'); }
    } else {
      setError(null); await startRecording(); setPhase('recording');
    }
  };

  const handleNext = () => {
    setResults(r => [...r, { label, score: result?.score || 0 }]);
    resetRecording(); setResult(null); setError(null);
    const next = current + 1;
    if (next >= sounds.length) { setPhase('done'); return; }
    setCurrent(next);
    const nextLabel = sounds[next]?.soundLabel || sounds[next]?.soundKey || '';
    setPracticeWord(getSoundWord(nextLabel) || nextLabel);
    setPhase('ready');
  };

  // ── Loading ──
  if (phase === 'loading') return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'40vh', gap:16 }}>
      <div style={{ fontSize:'3rem', animation:'pulse 1.5s ease infinite' }}>🔊</div>
      <p style={{ fontWeight:800, color:'#9BB0C2', margin:0 }}>{t.loading}</p>
    </div>
  );

  // ── Done ──
  if (phase === 'done') {
    const avg = results.length > 0 ? Math.round(results.reduce((a,b) => a + b.score, 0) / results.length) : 0;
    return (
      <div style={{ maxWidth:480, margin:'0 auto', animation:'slideUp 0.4s ease' }}>
        <div style={{ background:'linear-gradient(135deg,#80DCDC,#5BBFBF)', borderRadius:28, padding:'40px 28px', color:'white', textAlign:'center', marginBottom:20 }}>
          <div style={{ fontSize:'4rem', marginBottom:12 }}>{results.length === 0 ? '✅' : '🏆'}</div>
          <h2 style={{ fontWeight:900, fontSize:'1.5rem', margin:'0 0 8px' }}>
            {results.length === 0 ? t.noSounds : t.soundsRevised}
          </h2>
          {results.length > 0
            ? <p style={{ opacity:0.9, margin:0 }}>{results.length} {t.soundsDone} · {t.avgScore}: <strong>{avg}/100</strong></p>
            : <p style={{ opacity:0.85, fontSize:'0.88rem', margin:'12px 0 0', lineHeight:1.6 }}>{t.noSoundsDesc}</p>
          }
        </div>
        {results.length > 0 && (
          <div style={{ background:'white', borderRadius:20, border:'1.5px solid #F3F4F6', padding:'20px', marginBottom:16 }}>
            {results.map((r, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom: i < results.length-1 ? '1px solid #F9FAFB' : 'none' }}>
                <div style={{ width:40, height:40, borderRadius:12, background:'linear-gradient(135deg,#80DCDC,#5BBFBF)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.2rem', color:'white', fontWeight:900, flexShrink:0 }}>🔊</div>
                <span style={{ flex:1, fontWeight:800, color:'#1C2B3A' }}>{r.label}</span>
                <span style={{ fontSize:'0.7rem', fontWeight:700, color: r.score >= 70 ? '#15803D' : '#DC2626' }}>
                  {r.score >= 70 ? t.removed : t.kept}
                </span>
                <ScoreRing score={r.score} size={44} />
              </div>
            ))}
          </div>
        )}
        <button onClick={() => window.location.reload()} style={{ width:'100%', background:'#F9FAFB', border:'1.5px solid #F3F4F6', borderRadius:14, padding:'12px', fontWeight:800, cursor:'pointer', color:'#5F7183' }}>{t.restart}</button>
      </div>
    );
  }

  if (!currentSound) return null;

  // Example words for this sound
  const examples = SOUND_WORDS[label] || [];

  return (
    <div style={{ maxWidth:480, margin:'0 auto' }}>
      {/* Progress */}
      <div style={{ marginBottom:24 }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
          <span style={{ fontWeight:800, fontSize:'0.7rem', color:'#0284C7', textTransform:'uppercase', letterSpacing:'0.08em' }}>{t.progress}</span>
          <span style={{ fontWeight:800, fontSize:'0.75rem', color:'#9BB0C2' }}>{current + 1} / {sounds.length}</span>
        </div>
        <div style={{ height:8, background:'#F3F4F6', borderRadius:999, overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${progressPct}%`, background:'linear-gradient(90deg,#80DCDC,#5BBFBF)', borderRadius:999, transition:'width .5s' }} />
        </div>
      </div>

      {/* Sound card */}
      <div key={currentSound.id} style={{
        background:'white', borderRadius:28, border:'2px solid #80DCDC25',
        padding:'36px 24px', textAlign:'center', marginBottom:20,
        boxShadow:'0 12px 40px rgba(128,220,220,0.12)',
        animation: cardAnim === 'success' ? 'popSuccess 0.6s ease' : cardAnim === 'fail' ? 'shake 0.5s ease' : 'bounceIn 0.5s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        {/* Sound visual */}
        <div style={{ display:'flex', justifyContent:'center', marginBottom:22 }}>
          <div style={{ width:120, height:120, borderRadius:32, background:'linear-gradient(135deg,#80DCDC,#5BBFBF)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'3.2rem', boxShadow:'0 8px 28px rgba(128,220,220,0.4)' }}>
            🔊
          </div>
        </div>

        {/* Sound label */}
        <div style={{ fontWeight:900, fontSize:'2.4rem', color:'#1C2B3A', marginBottom:8, letterSpacing:'1px' }}>
          {label}
        </div>

        {/* Practice word */}
        <div style={{ fontWeight:800, fontSize:'1.3rem', color:'#0284C7', marginBottom:16 }}>
          → <em>"{practiceWord}"</em>
        </div>

        {/* Example words */}
        {examples.length > 0 && (
          <div style={{ marginBottom:18 }}>
            <span style={{ fontWeight:700, fontSize:'0.7rem', color:'#9BB0C2', textTransform:'uppercase', display:'block', marginBottom:8 }}>{t.examples}</span>
            <div style={{ display:'flex', gap:6, justifyContent:'center', flexWrap:'wrap' }}>
              {examples.slice(0,4).map(w => (
                <button key={w} onClick={() => speakIt(w)} style={{ background:'#F0F9FF', border:'none', borderRadius:10, padding:'5px 12px', cursor:'pointer', fontWeight:800, color:'#0284C7', fontSize:'0.85rem', transition:'background 0.2s' }}>
                  {w} <Volume2 style={{ width:11, height:11, verticalAlign:'middle', opacity:0.6 }} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Listen button */}
        <button onClick={() => speakIt(practiceWord)} style={{
          background:'#F0F9FF', border:'2px solid #80DCDC35', borderRadius:16,
          padding:'10px 24px', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:8,
          fontWeight:800, fontSize:'0.9rem', color:'#0284C7',
        }}>
          <Volume2 style={{ width:18, height:18 }} /> {t.listen}
        </button>
      </div>

      {/* Result */}
      {phase === 'result' && result && (
        <div style={{ marginBottom:16, animation:'slideUp 0.35s ease' }}>
          <div style={{
            background: result.score >= 70 ? '#F0FDF4' : result.score >= 50 ? '#FFFBEB' : '#FEF2F2',
            border:`2px solid ${result.score >= 70 ? '#86EFAC' : result.score >= 50 ? '#FCD34D' : '#FCA5A5'}`,
            borderRadius:20, padding:'16px 20px', display:'flex', alignItems:'center', gap:14, marginBottom:12,
          }}>
            <ScoreRing score={result.score} size={72} />
            <div style={{ flex:1 }}>
              <p style={{ fontWeight:900, fontSize:'1.05rem', margin:'0 0 4px',
                color: result.score >= 70 ? '#15803D' : result.score >= 50 ? '#B45309' : '#DC2626' }}>
                {result.score >= 85 ? t.perfect : result.score >= 70 ? t.excellent : result.score >= 55 ? t.good : t.rework}
              </p>
              {result.feedback && <p style={{ fontSize:'0.78rem', color:'#5F7183', margin:0, lineHeight:1.5 }}>{result.feedback}</p>}
            </div>
          </div>
          <button onClick={handleNext} style={{
            width:'100%', background:'linear-gradient(135deg,#80DCDC,#5BBFBF)',
            color:'white', border:'none', borderRadius:16, padding:'14px',
            fontWeight:900, fontSize:'1rem', cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            boxShadow:'0 4px 16px rgba(128,220,220,0.4)',
          }}>
            {current + 1 >= sounds.length
              ? <><Trophy style={{width:18,height:18}}/> {t.finish}</>
              : <>{t.next} <ArrowRight style={{width:18,height:18}}/></>}
          </button>
        </div>
      )}

      {/* Record */}
      {(phase === 'ready' || phase === 'recording' || phase === 'processing') && (
        <div style={{ textAlign:'center' }}>
          {error && <div style={{ background:'#FEF2F2', border:'1.5px solid #FCA5A5', borderRadius:12, padding:'8px 14px', marginBottom:12, color:'#DC2626', fontWeight:700, fontSize:'0.8rem' }}>{error}</div>}
          <p style={{ fontWeight:700, fontSize:'0.8rem', color:'#9BB0C2', marginBottom:16 }}>{t.soundHint}</p>
          <button onClick={handleRecord} disabled={phase === 'processing'} style={{
            width:92, height:92, borderRadius:'50%', border:'none',
            cursor: phase === 'processing' ? 'default' : 'pointer',
            background: phase === 'recording' ? '#EF4444' : '#80DCDC',
            color:'white', fontSize:'2.2rem',
            boxShadow: phase === 'recording' ? '0 0 0 0 rgba(239,68,68,0.4)' : '0 8px 28px rgba(128,220,220,0.5)',
            animation: phase === 'recording' ? 'recordPulse 1.5s ease infinite' : 'none',
            transition:'background 0.2s',
            display:'inline-flex', alignItems:'center', justifyContent:'center',
          }}>
            {phase === 'processing' ? '⏳' : phase === 'recording' ? '⏹' : '🎙️'}
          </button>
          <p style={{ fontWeight:700, fontSize:'0.76rem', color:'#5F7183', marginTop:10 }}>
            {phase === 'processing' ? t.analysing : phase === 'recording' ? t.stop : t.speak}
          </p>
        </div>
      )}
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function ExerciseRevision() {
  const navigate = useNavigate();
  const { getCefrLevel } = useAuth();
  const { lang } = useLanguage();
  const level = getCefrLevel() || 'B1';
  const t = T[lang] || T.fr;
  const [activeTab, setActiveTab] = useState('words');

  return (
    <Layout title={t.title}>
      <style>{CSS}</style>
      <div style={{ maxWidth:800, margin:'0 auto', padding:'20px 16px' }}>

        {/* Tabs */}
        <div style={{ display:'flex', gap:10, justifyContent:'center', marginBottom:28 }}>
          {[
            { key:'words', label:t.tabWords, active:'#E8926A' },
            { key:'sounds', label:t.tabSounds, active:'#80DCDC' },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
              background: activeTab === tab.key ? tab.active : 'white',
              color: activeTab === tab.key ? 'white' : '#5F7183',
              border: activeTab === tab.key ? 'none' : '1.5px solid #F3F4F6',
              borderRadius:14, padding:'10px 24px', cursor:'pointer',
              fontWeight:800, fontSize:'0.88rem', transition:'all 0.2s',
              boxShadow: activeTab === tab.key ? `0 4px 14px ${tab.active}40` : 'none',
            }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Card container */}
        <div style={{ background:'white', borderRadius:24, border:'1.5px solid #F3F4F6', padding:'32px 24px', boxShadow:'0 10px 30px rgba(0,0,0,0.02)' }}>
          {activeTab === 'words'
            ? <WordRevisionTab level={level} lang={lang} />
            : <SoundRevisionTab level={level} lang={lang} />
          }
        </div>

        <div style={{ textAlign:'center', marginTop:28 }}>
          <button onClick={() => navigate('/exercises')} style={{ background:'white', border:'1.5px solid #F3F4F6', borderRadius:12, padding:'10px 24px', fontWeight:800, fontSize:'0.85rem', color:'#9BB0C2', cursor:'pointer' }}>
            {t.back}
          </button>
        </div>
      </div>
    </Layout>
  );
}
