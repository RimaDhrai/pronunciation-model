import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import WaveVisualizer from '../components/ui/WaveVisualizer';
import MicButton from '../components/ui/MicButton';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { ArrowLeft, ChevronRight, Trophy } from 'lucide-react';
import api from '../api/axios';

const T = {
  fr: {
    pronounce: 'Prononcez cette phrase',
    youSaid: 'CE QUE TU AS DIT',
    correct: '✓ Correct', wrong: '✗ Mal dit', omit: '○ Omis',
    attempt: (n, max) => `Essai ${n}/${max}`,
    maxAttempts: '⛔ Max essais atteint',
    retry: (n) => `🔄 Réessayer (${n} restant${n > 1 ? 's' : ''})`,
    next: 'Suivant', results: 'Voir résultats',
    record: 'Appuyez pour enregistrer',
    recording: '🔴 Enregistrement en cours...',
    preview: 'Aperçu',
    reRecord: '🔄 Ré-enregistrer', analyze: '✓ Analyser',
    processing: 'Analyse en cours...', processSub: "L'IA analyse votre audio…",
    coach: '💡 Coach IA',
    scoresTitle: 'Mes scores par phrase', phraseLabel: (i) => `Phrase ${i + 1}`,
    avgScore: 'Score moyen', xpEarned: 'XP gagnés', phrases: 'Phrases',
    mastered: 'Niveau maîtrisé !', done: 'Session terminée !',
    unlocked: (l) => `Niveau ${l} débloqué ! 🔓`, maxLevel: 'Tu as atteint le niveau maximum !',
    back: '← Retour', replay: '🔄 Rejouer', seeAll: 'Voir tous les niveaux →',
    streak: (n) => `${n} bonne(s) réponse(s) d'affilée !`,
    serverError: 'Serveur IA indisponible', retry2: '🔄 Réessayer', backLevels: '← Retour aux niveaux',
    showIpa: 'Voir IPA', hideIpa: 'Masquer IPA',
    loading: "L'IA prépare tes phrases...", loadingSub: 'Génération IA niveau',
    unlockedBanner: (l) => `Niveau ${l} débloqué !`, unlockedSub: (l) => `Tu peux maintenant accéder aux exercices ${l}`,
    pageTitle: (lvl) => `Exercices ${lvl}`,
    pageTitleDone: (lvl) => `Exercices ${lvl} — Terminé`,
    pageTitleActive: (lvl, label) => `Exercices ${lvl} — ${label}`,
    errorLoad: 'Impossible de charger les phrases. Vérifiez que le serveur IA est démarré.',
    shortRec: 'Enregistrement trop court. Reparlez.',
    clickMic: 'Cliquez sur le micro pour enregistrer.',
    sttErr: '🎙️ Audio non reconnu. Parlez plus fort.',
    networkErr: (msg) => `Erreur réseau : ${msg}`,
  },
  en: {
    pronounce: 'Pronounce this phrase',
    youSaid: 'WHAT YOU SAID',
    correct: '✓ Correct', wrong: '✗ Wrong', omit: '○ Missed',
    attempt: (n, max) => `Attempt ${n}/${max}`,
    maxAttempts: '⛔ Max attempts reached',
    retry: (n) => `🔄 Retry (${n} left)`,
    next: 'Next', results: 'See results',
    record: 'Click to record',
    recording: '🔴 Recording...',
    preview: 'Preview',
    reRecord: '🔄 Re-record', analyze: '✓ Analyze',
    processing: 'Analyzing...', processSub: 'AI is analyzing your audio…',
    coach: '💡 AI Coach',
    scoresTitle: 'My scores per phrase', phraseLabel: (i) => `Phrase ${i + 1}`,
    avgScore: 'Avg score', xpEarned: 'XP earned', phrases: 'Phrases',
    mastered: 'Level mastered!', done: 'Session complete!',
    unlocked: (l) => `Level ${l} unlocked! 🔓`, maxLevel: 'You reached the highest level!',
    back: '← Back', replay: '🔄 Play again', seeAll: 'See all levels →',
    streak: (n) => `${n} correct answer${n > 1 ? 's' : ''} in a row!`,
    serverError: 'AI server unavailable', retry2: '🔄 Retry', backLevels: '← Back to levels',
    showIpa: 'Show IPA', hideIpa: 'Hide IPA',
    loading: 'AI is preparing your phrases...', loadingSub: 'AI generation level',
    unlockedBanner: (l) => `Level ${l} unlocked!`, unlockedSub: (l) => `You can now access ${l} exercises`,
    pageTitle: (lvl) => `Exercises ${lvl}`,
    pageTitleDone: (lvl) => `Exercises ${lvl} — Completed`,
    pageTitleActive: (lvl, label) => `Exercises ${lvl} — ${label}`,
    errorLoad: 'Impossible to load phrases. Ensure AI server is running.',
    shortRec: 'Recording too short. Speak again.',
    clickMic: 'Click the mic to record.',
    sttErr: '🎙️ Audio not recognized. Speak louder.',
    networkErr: (msg) => `Network error: ${msg}`,
  },
};
import { completeLevel } from '../api/exerciseProgress';
import { saveSession, getMe } from '../api/auth';
import { recordErrors } from '../api/spacedRepetition';

// All audio analysis goes through Vite proxy (/analyze → FastAPI, /api/practice → Spring Boot)

const LEVEL_CONFIG = {
  fr: {
    A1: { color:'#80DCDC', colorDark:'#4DBFBF', colorBg:'#E8F9F9', colorSoft:'#F0FDFD', emoji:'🌱', label:'Débutant' },
    A2: { color:'#6BACD4', colorDark:'#4A90BD', colorBg:'#EBF4FB', colorSoft:'#F0F8FF', emoji:'🌿', label:'Élémentaire' },
    B1: { color:'#9580D4', colorDark:'#7D66C0', colorBg:'#F3F0FE', colorSoft:'#F8F6FF', emoji:'🌳', label:'Intermédiaire' },
    B2: { color:'#E8926A', colorDark:'#D47A52', colorBg:'#FEF3EC', colorSoft:'#FEF8F3', emoji:'🦅', label:'Intermédiaire+' },
    C1: { color:'#E8476A', colorDark:'#C8305A', colorBg:'#FDE8EE', colorSoft:'#FEF0F5', emoji:'🔥', label:'Avancé' },
    C2: { color:'#F0C85A', colorDark:'#B89B30', colorBg:'#FEF9E0', colorSoft:'#FEFCF0', emoji:'👑', label:'Maîtrise' },
  },
  en: {
    A1: { color:'#80DCDC', colorDark:'#4DBFBF', colorBg:'#E8F9F9', colorSoft:'#F0FDFD', emoji:'🌱', label:'Beginner' },
    A2: { color:'#6BACD4', colorDark:'#4A90BD', colorBg:'#EBF4FB', colorSoft:'#F0F8FF', emoji:'🌿', label:'Elementary' },
    B1: { color:'#9580D4', colorDark:'#7D66C0', colorBg:'#F3F0FE', colorSoft:'#F8F6FF', emoji:'🌳', label:'Intermediate' },
    B2: { color:'#E8926A', colorDark:'#D47A52', colorBg:'#FEF3EC', colorSoft:'#FEF8F3', emoji:'🦅', label:'Upper-Interm.' },
    C1: { color:'#E8476A', colorDark:'#C8305A', colorBg:'#FDE8EE', colorSoft:'#FEF0F5', emoji:'🔥', label:'Advanced' },
    C2: { color:'#F0C85A', colorDark:'#B89B30', colorBg:'#FEF9E0', colorSoft:'#FEFCF0', emoji:'👑', label:'Mastery' },
  }
};

const TOTAL = 10;
const LIVES_MAX = 3;
const MAX_ATTEMPTS = 3;

// Phrases de secours utilisées si Ollama dépasse 15 s (référencé dans useFallback)
const FALLBACK_PHRASES = {
  fr: {
    A1: ["Bonjour, comment allez-vous","Le chat mange du poisson","Il fait beau aujourd'hui","Je m'appelle Marie","J'aime le café le matin","La maison est grande","Mon ami s'appelle Pierre","Il pleut beaucoup en novembre","Je travaille tous les jours","Nous allons au marché"],
    A2: ["Je voudrais réserver une table pour deux personnes","Le train part à dix heures du matin","Pouvez-vous m'indiquer le chemin","Elle préfère le thé au café","Nous habitons dans une petite ville","J'ai visité Paris l'année dernière","Le musée ouvre à neuf heures","Mon frère étudie la médecine","Il faut prendre le bus numéro sept","La cuisine française est délicieuse"],
    B1: ["La réunion a été reportée à la semaine prochaine","Je dois envoyer ce rapport avant vendredi soir","Les résultats de l'examen seront publiés demain","Elle a décidé de changer de carrière professionnelle","Le projet nécessite une collaboration étroite entre équipes","Nous avons discuté des nouvelles propositions pendant deux heures","Il est important de maintenir une bonne hygiène de vie","La ville a inauguré un nouveau centre culturel moderne","Les négociations ont abouti à un accord satisfaisant","Je cherche un appartement proche des transports en commun"],
    B2: ["Les entreprises innovantes s'adaptent rapidement aux évolutions du marché","La gestion efficace du temps est une compétence professionnelle essentielle","Les recherches scientifiques progressent grâce aux nouvelles technologies numériques","Il convient d'analyser les données avant de tirer des conclusions hâtives","La mondialisation a profondément transformé les échanges économiques mondiaux","Les politiques environnementales doivent concilier développement et durabilité","Une communication claire est indispensable pour éviter les malentendus","Les investissements dans l'éducation garantissent la prospérité future","Le débat philosophique sur la liberté reste d'une actualité brûlante","Les nouvelles réglementations fiscales affectent les petites entreprises locales"],
    C1: ["La complexité des enjeux géopolitiques contemporains requiert une analyse nuancée","L'émergence des technologies d'intelligence artificielle soulève des questions éthiques fondamentales","La réforme structurelle de l'économie nécessite des mesures législatives audacieuses","Les paradigmes scientifiques évoluent au fil des découvertes et remises en question","L'interdépendance croissante des économies mondiales fragilise les équilibres traditionnels","La rhétorique politique contemporaine privilégie souvent l'émotion sur la raison","Les mutations sociétales profondes exigent une adaptation continue des institutions","La préservation du patrimoine culturel immatériel constitue un défi majeur","L'urbanisation accélérée engendre des problématiques complexes de cohésion sociale","Les inégalités persistantes fragilisent le tissu démocratique des sociétés modernes"],
    C2: ["La dialectique hégélienne a profondément influencé la philosophie politique européenne","L'épistémologie contemporaine remet en question les fondements du savoir scientifique","La polysémie de certains termes juridiques complique l'interprétation des textes législatifs","Les interactions complexes entre génétique et environnement déterminent les phénotypes observés","La déconstruction des métarécits postmodernes a fragmenté les cadres interprétatifs traditionnels","L'herméneutique ricoeurienne propose une médiation entre explication et compréhension","Les asymétries informationnelles engendrent des inefficiences sur les marchés financiers","La phénoménologie husserlienne explore la structure intentionnelle de la conscience","Les mécanismes d'autocorrection des systèmes complexes garantissent leur résilience","La transversalité des compétences cognitives facilite l'apprentissage de nouveaux domaines"],
  },
  en: {
    A1: ["Hello, how are you today","The cat is sleeping on the sofa","I like to eat pizza","She has a blue car","Good morning, my name is John","The weather is nice today","We go to school every day","I want a glass of water","My dog is very friendly","The book is on the table"],
    A2: ["I would like to order a coffee please","Can you help me find the station","She usually wakes up at seven","We visited the museum last weekend","The restaurant opens at noon","He is studying English at university","I need to buy some groceries","They live near the city center","The movie starts at eight o'clock","My sister works as a nurse"],
    B1: ["The meeting has been postponed until next week","I need to finish this report before Friday","She decided to change her career path","The project requires close teamwork between departments","We discussed the new proposals for two hours","It is important to maintain a healthy lifestyle","The city opened a new cultural center last month","The negotiations led to a satisfactory agreement","I am looking for an apartment near public transport","He has been learning Spanish for three years"],
    B2: ["Innovative companies adapt quickly to changing market conditions","Effective time management is an essential professional skill","Scientific research advances thanks to new digital technologies","It is important to analyze data before drawing hasty conclusions","Globalization has profoundly transformed international economic exchanges","Environmental policies must balance development with sustainability goals","Clear communication is essential to avoid misunderstandings in the workplace","Investments in education guarantee long-term prosperity for nations","The philosophical debate on freedom remains highly relevant today","New tax regulations significantly affect small local businesses"],
    C1: ["The complexity of contemporary geopolitical issues requires nuanced analysis","The emergence of artificial intelligence raises fundamental ethical questions","Structural economic reform requires bold legislative measures and political will","Scientific paradigms evolve through discoveries that challenge existing frameworks","The growing interdependence of global economies undermines traditional balances","Contemporary political rhetoric often prioritizes emotion over rational discourse","Profound societal changes demand continuous adaptation of existing institutions","The preservation of intangible cultural heritage represents a major challenge","Accelerated urbanization creates complex issues of social cohesion and inequality","Persistent inequalities undermine the democratic fabric of modern societies"],
    C2: ["Hegelian dialectics profoundly influenced European political philosophy","Contemporary epistemology questions the very foundations of scientific knowledge","The polysemy of certain legal terms complicates the interpretation of legislation","Complex interactions between genetics and environment determine observable phenotypes","The deconstruction of postmodern metanarratives fragmented traditional interpretive frameworks","Ricoeurian hermeneutics proposes a mediation between explanation and understanding","Informational asymmetries generate inefficiencies across financial markets","Husserlian phenomenology explores the intentional structure of consciousness","Self-correction mechanisms in complex systems guarantee their long-term resilience","The transversality of cognitive skills facilitates learning across new domains"],
  }
};

// ── Colored word token — vert/orange/rouge ────────────────────────────────────
function WordToken({ word, op, spoken, ipa }) {
  const styles = {
    MATCH: { bg:'#DCFCE7', text:'#15803D', border:'#22C55E', label:null },
    SUB:   { bg:'#FEE2E2', text:'#B91C1C', border:'#EF4444', label:spoken ? `→ ${spoken}` : '✗' },
    DEL:   { bg:'#FFEDD5', text:'#C2410C', border:'#F97316', label:'(omis)' },
    INS:   { bg:'#FEF9C3', text:'#A16207', border:'#EAB308', label:null },
  };
  const s = styles[op] || styles.MATCH;
  return (
    <span style={{display:'inline-flex',flexDirection:'column',alignItems:'center',margin:'3px 4px'}}>
      <span style={{
        padding:'5px 10px', borderRadius:'10px', fontSize:'15px', fontWeight:800,
        background:s.bg, color:s.text, border:`2px solid ${s.border}`,
        textDecoration: op==='DEL' ? 'line-through' : 'none',
        transition:'all 0.2s',
      }}>{word}</span>
      {ipa && (op === 'SUB' || op === 'DEL') && (
        <span style={{fontSize:'8px', color:'#38bdf8', fontFamily:'monospace', fontWeight:700, marginTop:'2px', background:'rgba(56,189,248,.12)', padding:'1px 5px', borderRadius:3, letterSpacing:'.5px'}}>/{ipa}/</span>
      )}
      {s.label && <span style={{fontSize:'9px',fontWeight:700,color:s.text,marginTop:'2px'}}>{s.label}</span>}
    </span>
  );
}

// ── Score banner ──────────────────────────────────────────────────────────────
const SCORE_CONFIGS = {
  fr: [
    { min:90, bg:'#E8F9F9', border:'#80DCDC', text:'#2D7A7A', icon:'🏆', title:(s)=>`Excellent ! ${s}/100`, sub:'Prononciation quasi-native !' },
    { min:75, bg:'#EBF4FB', border:'#6BACD4', text:'#4A90BD', icon:'🎉', title:(s)=>`Très bien ! ${s}/100`, sub:'Continue comme ça !' },
    { min:60, bg:'#F3F0FE', border:'#9580D4', text:'#7D66C0', icon:'💪', title:(s)=>`Bien ! ${s}/100`, sub:'Travaille les mots en rouge' },
    { min:40, bg:'#FEF3EC', border:'#E8926A', text:'#D47A52', icon:'🔄', title:(s)=>`Passable — ${s}/100`, sub:'Ralentis et réessaie' },
    { min:0,  bg:'#FDE8EE', border:'#E8476A', text:'#C8305A', icon:'💫', title:(s)=>`À retravailler — ${s}/100`, sub:'Prononce syllabe par syllabe' },
  ],
  en: [
    { min:90, bg:'#E8F9F9', border:'#80DCDC', text:'#2D7A7A', icon:'🏆', title:(s)=>`Excellent! ${s}/100`, sub:'Near-native pronunciation!' },
    { min:75, bg:'#EBF4FB', border:'#6BACD4', text:'#4A90BD', icon:'🎉', title:(s)=>`Very good! ${s}/100`, sub:'Keep it up!' },
    { min:60, bg:'#F3F0FE', border:'#9580D4', text:'#7D66C0', icon:'💪', title:(s)=>`Good! ${s}/100`, sub:'Work on the red words' },
    { min:40, bg:'#FEF3EC', border:'#E8926A', text:'#D47A52', icon:'🔄', title:(s)=>`Fair — ${s}/100`, sub:'Slow down and try again' },
    { min:0,  bg:'#FDE8EE', border:'#E8476A', text:'#C8305A', icon:'💫', title:(s)=>`Needs work — ${s}/100`, sub:'Pronounce syllable by syllable' },
  ],
};

function ScoreBanner({ score, xp, lang }) {
  const safeScore = typeof score === 'number' && !isNaN(score) ? score : 0;
  const configs = SCORE_CONFIGS[lang] || SCORE_CONFIGS.fr;
  const c = configs.find(x => safeScore >= x.min) || configs[configs.length - 1];

  // Score ring color
  const ringColor = safeScore >= 75 ? '#80DCDC' : safeScore >= 60 ? '#6BACD4' : safeScore >= 40 ? '#E8926A' : '#E8476A';

  return (
    <div style={{background:c.bg, border:`2px solid ${c.border}`, borderRadius:'16px', padding:'14px 16px', display:'flex', alignItems:'center', gap:'14px'}}>
      {/* Circular score */}
      <div style={{position:'relative', width:'56px', height:'56px', flexShrink:0}}>
        <svg width="56" height="56" viewBox="0 0 56 56">
          <circle cx="28" cy="28" r="23" fill="none" stroke="#E5E7EB" strokeWidth="5"/>
          <circle cx="28" cy="28" r="23" fill="none" stroke={ringColor} strokeWidth="5"
            strokeDasharray={`${2*Math.PI*23}`}
            strokeDashoffset={`${2*Math.PI*23*(1-safeScore/100)}`}
            strokeLinecap="round"
            transform="rotate(-90 28 28)"
            style={{transition:'stroke-dashoffset 0.8s ease'}}
          />
        </svg>
        <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',fontWeight:900,fontSize:'13px',color:c.text}}>{safeScore}</div>
      </div>
      <div style={{flex:1, minWidth:0}}>
        <div style={{fontWeight:900, fontSize:'15px', color:c.text, display:'flex', alignItems:'center', gap:'6px'}}>
          <span>{c.icon}</span>
          <span>{c.title(safeScore)}</span>
        </div>
        <div style={{fontSize:'12px', color:c.text, opacity:0.8, marginTop:'2px'}}>{c.sub}</div>
      </div>
      <div style={{background:c.border, color:'white', borderRadius:'12px', padding:'6px 10px', textAlign:'center', fontWeight:900, flexShrink:0}}>
        <div style={{fontSize:'10px', opacity:0.85}}>+XP</div>
        <div style={{fontSize:'18px', lineHeight:1}}>+{xp}</div>
      </div>
    </div>
  );
}

// ── Fix Windows-1252 / Latin-1 garbled UTF-8 emojis from Qwen/Ollama ─────────
function sanitizeFeedback(str) {
  if (!str) return str;
  // Map Windows-1252 codepoints back to their original byte values
  const CP1252 = {
    0x20AC:0x80,0x201A:0x82,0x0192:0x83,0x201E:0x84,0x2026:0x85,
    0x2020:0x86,0x2021:0x87,0x02C6:0x88,0x2030:0x89,0x0160:0x8A,
    0x2039:0x8B,0x0152:0x8C,0x017D:0x8E,0x2018:0x91,0x2019:0x92,
    0x201C:0x93,0x201D:0x94,0x2022:0x95,0x2013:0x96,0x2014:0x97,
    0x02DC:0x98,0x2122:0x99,0x0161:0x9A,0x203A:0x9B,0x0153:0x9C,
    0x017E:0x9E,0x0178:0x9F,
  };
  // Detect garbled: "ðŸ" = 0xF0 0x9F = start of most 4-byte emoji mis-decoded
  const isGarbled = str.includes('ðŸ') || str.includes('âœ') || /ð[ŸŽ']/.test(str);
  if (!isGarbled) return str;
  try {
    const bytes = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      bytes[i] = CP1252[c] ?? (c <= 0xFF ? c : 0x3F);
    }
    const fixed = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    return fixed && fixed.length > 0 ? fixed : str;
  } catch { return str; }
}

// ── Coach IA feedback — rich personalized display ─────────────────────────────
function CoachFeedback({ feedback, score, ops, firstName, lang }) {
  if (!feedback) return null;

  // Fix encoding issues from Qwen/Ollama (emojis garbled as Latin-1)
  const cleanFeedback = sanitizeFeedback(feedback);

  // Parse emoji-prefixed sections from the feedback string
  const SECTION_ICONS = [
    { emoji: '🎯', bg: '#EFF6FF', border: '#BFDBFE', color: '#1D4ED8', icon: '🎯' },
    { emoji: '✅', bg: '#F0FDF4', border: '#BBF7D0', color: '#15803D', icon: '✅' },
    { emoji: '❌', bg: '#FEF2F2', border: '#FECACA', color: '#B91C1C', icon: '❌' },
    { emoji: '💡', bg: '#FFFBEB', border: '#FDE68A', color: '#B45309', icon: '💡' },
    { emoji: '🔥', bg: '#FFF7ED', border: '#FED7AA', color: '#C2410C', icon: '🔥' },
    { emoji: '⚡', bg: '#F5F3FF', border: '#DDD6FE', color: '#7C3AED', icon: '⚡' },
  ];

  // Split by lines and group into sections
  const lines = cleanFeedback.split('\n').map(l => l.trim()).filter(Boolean);
  const sections = [];
  let current = null;

  for (const line of lines) {
    const found = SECTION_ICONS.find(s => line.startsWith(s.emoji));
    if (found) {
      if (current) sections.push(current);
      current = { ...found, text: line.slice(found.emoji.length).trim() };
    } else if (current) {
      current.text += ' ' + line;
    } else {
      // no emoji prefix — treat as plain intro
      sections.push({ emoji: '💬', bg: '#F9FAFB', border: '#E5E7EB', color: '#374151', icon: '💬', text: line });
    }
  }
  if (current) sections.push(current);

  // Missed words from ops
  const missedWords = (ops || [])
    .filter(op => op.op === 'SUB' || op.op === 'DEL')
    .map(op => op.expected)
    .filter(Boolean);

  // Score-based accent color
  const accentColor = score >= 85 ? '#14B8A6' : score >= 65 ? '#6366F1' : score >= 45 ? '#F97316' : '#EF4444';
  const accentBg    = score >= 85 ? '#F0FDFA' : score >= 65 ? '#EEF2FF' : score >= 45 ? '#FFF7ED' : '#FEF2F2';
  const label       = lang === 'en' ? 'AI Coach' : 'Coach IA';
  const name        = firstName || (lang === 'en' ? 'you' : 'toi');

  return (
    <div className="slide-up" style={{
      background: 'white',
      border: `2px solid ${accentColor}`,
      borderRadius: '20px',
      overflow: 'hidden',
      marginBottom: '16px',
      boxShadow: `0 4px 16px ${accentColor}22`,
    }}>
      {/* Header */}
      <div style={{
        background: accentBg,
        borderBottom: `1.5px solid ${accentColor}33`,
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}>
        <div style={{
          width: '34px', height: '34px', borderRadius: '50%',
          background: accentColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '16px', flexShrink: 0,
        }}>🤖</div>
        <div>
          <div style={{ fontWeight: 900, fontSize: '12px', color: accentColor, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {label}
          </div>
          <div style={{ fontSize: '11px', color: '#6B7280' }}>
            {lang === 'en' ? `Personalized analysis for ${name}` : `Analyse personnalisée pour ${name}`}
          </div>
        </div>
        {missedWords.length > 0 && (
          <div style={{ marginLeft: 'auto', background: '#FEE2E2', borderRadius: '8px', padding: '3px 8px' }}>
            <span style={{ fontSize: '10px', fontWeight: 800, color: '#B91C1C' }}>
              {missedWords.length} {lang === 'en' ? 'error' + (missedWords.length > 1 ? 's' : '') : 'erreur' + (missedWords.length > 1 ? 's' : '')}
            </span>
          </div>
        )}
      </div>

      {/* Missed words pills */}
      {missedWords.length > 0 && (
        <div style={{ padding: '10px 16px 0', display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
          <span style={{ fontSize: '10px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {lang === 'en' ? 'Words to practice:' : 'Mots à retravailler :'}
          </span>
          {missedWords.map((w, i) => (
            <span key={i} style={{
              background: '#FEE2E2', color: '#B91C1C',
              border: '1.5px solid #FECACA',
              borderRadius: '20px', padding: '2px 10px',
              fontSize: '12px', fontWeight: 700,
            }}>🔤 {w}</span>
          ))}
        </div>
      )}

      {/* Sections */}
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {sections.length > 0 ? sections.map((s, i) => (
          <div key={i} style={{
            background: s.bg,
            border: `1.5px solid ${s.border}`,
            borderRadius: '12px',
            padding: '9px 13px',
            display: 'flex',
            gap: '10px',
            alignItems: 'flex-start',
          }}>
            <span style={{ fontSize: '16px', flexShrink: 0, marginTop: '1px' }}>{s.icon}</span>
            <span style={{ fontSize: '13px', color: s.color, lineHeight: 1.55, fontWeight: 500 }}>{s.text}</span>
          </div>
        )) : (
          <div style={{ fontSize: '13px', color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
            {feedback}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Lives display ─────────────────────────────────────────────────────────────
function LivesRow({ lives, maxLives }) {
  return (
    <div style={{display:'flex', gap:'6px', alignItems:'center'}}>
      {Array.from({length:maxLives}).map((_,i) => (
        <div key={i} style={{
          fontSize:'20px', transition:'all 0.3s',
          filter: i < lives ? 'none' : 'grayscale(100%)',
          opacity: i < lives ? 1 : 0.3,
          transform: i < lives ? 'scale(1)' : 'scale(0.85)',
        }}>❤️</div>
      ))}
    </div>
  );
}

export default function ExerciseSession() {
  const { level } = useParams();
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const { lang } = useLanguage();
  const t = T[lang] || T.fr;
  const levelCfg = LEVEL_CONFIG[lang] || LEVEL_CONFIG.fr;
  const cfg = levelCfg[level] || levelCfg.B1;

  const [phrases, setPhrases]     = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [phase, setPhase]         = useState('loading');
  const [recState, setRecState]   = useState('idle');
  const [result, setResult]       = useState(null);
  const [audioUrl, setAudioUrl]   = useState(null);
  const [error, setError]         = useState(null);
  const [scores, setScores]       = useState([]);
  const [lives, setLives]         = useState(LIVES_MAX);
  const [streak, setStreak]       = useState(0);
  const [sessionXP, setSessionXP] = useState(0);
  const [showResultAnim, setShowResultAnim] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);
  const [showIpa, setShowIpa]   = useState(false);
  const [phraseIpa, setPhraseIpa] = useState(null);

  const capturedBlobRef = useRef(null);

  const { isRecording, audioLevel, error: micError, startRecording, stopRecording, resetRecording } = useAudioRecorder();

  const currentPhrase = phrases[currentIdx] || '';

  // Load phrases — localStorage cache (1 h TTL) then Ollama fallback
  useEffect(() => {
    const CACHE_TTL = 60 * 60 * 1000; // 1 hour
    const cacheKey  = `ex_phrases_${lang}_${level}`;

    const load = async () => {
      // Try cache first — instant open
      try {
        const raw = localStorage.getItem(cacheKey);
        if (raw) {
          const { phrases: cached, ts } = JSON.parse(raw);
          if (Array.isArray(cached) && cached.length >= TOTAL && Date.now() - ts < CACHE_TTL) {
            setPhrases(cached);
            setCurrentIdx(0); setScores([]); setLives(LIVES_MAX);
            setStreak(0); setSessionXP(0); setResult(null); setError(null);
            setPhase('ready');
            return; // done — no API call needed
          }
        }
      } catch { /* ignore localStorage errors */ }

      // Cache miss — fetch from Ollama (15s timeout, fallback to static phrases)
      setPhase('loading');
      setPhrases([]); setCurrentIdx(0); setScores([]); setLives(LIVES_MAX);
      setStreak(0); setSessionXP(0); setResult(null); setError(null);

      const useFallback = (_reason) => {
        const pool = (FALLBACK_PHRASES[lang] || FALLBACK_PHRASES.fr)[level]
                  || FALLBACK_PHRASES.fr.B1;
        const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, TOTAL);
        setPhrases(shuffled);
        setPhase('ready');
        // Cache them too so next visit is instant
        try { localStorage.setItem(cacheKey, JSON.stringify({ phrases: shuffled, ts: Date.now() - 55 * 60 * 1000 })); } catch { /* ignore */ }
      };

      try {
        const res = await api.get(
          `/api/exercises/phrases/${level}?lang=${lang}&count=${TOTAL}`,
          { timeout: 15000 }
        );
        const data = res.data;
        if (data.phrases?.length) {
          setPhrases(data.phrases);
          setPhase('ready');
          try { localStorage.setItem(cacheKey, JSON.stringify({ phrases: data.phrases, ts: Date.now() })); } catch { /* ignore */ }
        } else useFallback('empty');
      } catch(e) {
        useFallback('error');
      }
    };
    load();
  }, [level, lang]);

  // Lazy-fetch IPA for current phrase when user toggles the hint (or when analyze result provides it)
  useEffect(() => {
    if (!showIpa || !currentPhrase || phraseIpa !== null) return;
    fetch(`/phonemes?text=${encodeURIComponent(currentPhrase)}&lang=${lang}`)
      .then(r => r.json())
      .then(d => setPhraseIpa((d.words || []).filter(w => w.ipa)))
      .catch(() => setPhraseIpa([]));
  }, [showIpa, currentPhrase, lang, phraseIpa]);

  // La progression est enregistrée uniquement via completeLevel() → PostgreSQL (Spring Boot)

  const handleStartRec = async () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null); capturedBlobRef.current = null;
    setError(null); setRecState('recording'); setPhase('recording');
    await startRecording();
  };

  const handleStopRec = async () => {
    const blob = await stopRecording();
    if (!blob || blob.size < 100) { setError(t.shortRec); setRecState('idle'); setPhase('ready'); return; }
    capturedBlobRef.current = blob;
    setAudioUrl(URL.createObjectURL(blob));
    setRecState('recorded');
    setPhase('recorded');
  };

  const handleReRecord = () => {
    if (attemptCount >= MAX_ATTEMPTS - 1) {
      // Used all attempts — move on automatically
      handleNext();
      return;
    }
    setAttemptCount(c => c + 1);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null); capturedBlobRef.current = null;
    setError(null); resetRecording(); setRecState('idle'); setResult(null); setPhase('ready');
  };

  const handleSubmit = async () => {
    const blob = capturedBlobRef.current;
    if (!blob) { setError(t.clickMic); return; }
    setPhase('processing'); setError(null);
    try {
      const fd = new FormData();
      fd.append('file', blob, 'audio.webm');
      fd.append('expectedPhrase', currentPhrase);
      fd.append('lang', lang);
      fd.append('level', level);
      fd.append('phraseIndex', String(currentIdx));
      fd.append('job_title', user?.jobTitle || '');
      fd.append('native_lang', user?.nativeLang || lang);
      // ── TASK 1 : Whisper STT via proxy Vite → FastAPI (~2-4s) ────────────
      const r = await fetch('/analyze', { method: 'POST', body: fd });
      if (!r.ok) throw new Error('analyze_failed');
      const data = await r.json();

      if (data.stt_error) { setError(t.sttErr); setPhase('ready'); setRecState('idle'); return; }

      // Capture phoneme data from analyze response (IPA per word)
      const phonemeWords = data.phonemes?.word_phonemes?.filter(p => p.ipa) ?? [];
      if (phonemeWords.length > 0) setPhraseIpa(phonemeWords);

      // Score = 60% word_diff + 40% confiance Whisper
      // Si Whisper hallucine (phrase complétée automatiquement), on plafonne à 35
      const suspected = data.suspected_hallucination === true;
      let score = Math.round((data.word_diff_score ?? 0) * 0.6 + (data.avg_confidence ?? 0) * 100 * 0.4);
      // G2P penalty: weak phonemes reduce score by up to 20 pts
      const weakCount  = data.phonemes?.weak_phonemes?.length ?? 0;
      const totalCount = data.phonemes?.word_phonemes?.length || 1;
      score = Math.max(0, score - Math.round((weakCount / totalCount) * 20));
      if (suspected) score = Math.min(score, 35);
      const xp    = score >= 80 ? 15 : score >= 60 ? 10 : score >= 40 ? 5 : 2;

      // ── Affichage IMMÉDIAT du score (zéro attente IA) ─────────────────
      setResult({ ...data, score, suspected_hallucination: suspected, feedback: '' });
      setScores(prev => [...prev, score]);
      setSessionXP(prev => prev + xp);
      setShowResultAnim(true);
      setTimeout(() => setShowResultAnim(false), 600);
      if (score >= 65) setStreak(s => s + 1);
      else setStreak(0);
      // Lives lost per phrase (on Next), not per attempt — tracked via result.score
      setPhase('result');

      // ── Mots ratés → révision espacée (immédiat, pas de LLM) ────────────
      const missedWords = (data.ops || [])
        .filter(op => op.op === 'SUB' || op.op === 'DEL')
        .map(op => ({ word: op.expected, level }));
      if (missedWords.length > 0) recordErrors(missedWords).catch(() => {});

      // ── Reporter au MasterAgent (fire-and-forget) ─────────────────────
      const masterSid = localStorage.getItem('masterSessionId');
      if (masterSid) {
        api.post('/api/master/turn', {
          session_id: masterSid,
          mode: 'EXERCISE',
          score_input: score,
          lang,
          phoneme_errors: missedWords.map(w => w.word),
        }).catch(() => {});
      }

      // ── TASK 2 : Feedback IA Spring Boot (~2s, pendant que user voit score) ──
      api.post('/api/practice/feedback/generate', {
        lang, level, expectedPhrase: currentPhrase,
        transcript: data.clean_transcript || data.transcript || '',
        score, ops: data.ops || [],
        suspected_hallucination: suspected,
        n_expected: data.n_expected ?? 0,
        n_match: data.n_match ?? 0,
      }).then(fbRes => {
        const aiFeedback = fbRes.data?.feedback || '';
        if (aiFeedback.trim().length > 10)
          setResult(prev => prev ? { ...prev, feedback: aiFeedback } : prev);
        // Sauvegarde avec le vrai feedback IA
        saveSession({ type: `Exercise ${level}`, phrase: currentPhrase, score, lang, level, feedback: aiFeedback }).catch(() => {});
      }).catch(() => {
        saveSession({ type: `Exercise ${level}`, phrase: currentPhrase, score, lang, level, feedback: '' }).catch(() => {});
      });
    } catch(e) { setError(t.networkErr(e.message)); setPhase('ready'); }
  };

  const handleNext = async () => {
    // Lose 1 life per phrase (not per attempt) when final score < 40
    if (result?.score < 40) setLives(l => Math.max(0, l - 1));

    if (currentIdx + 1 >= TOTAL) {
      // Sauvegarder la progression dans PostgreSQL via Spring Boot
      const allScores = [...scores];
      const avg = allScores.length > 0 ? Math.round(allScores.reduce((a,b)=>a+b,0)/allScores.length) : 0;
      try {
        await completeLevel(level, avg, TOTAL);
        // Rafraîchir user → XP, streak, badges mis à jour dans le contexte
        getMe().then(res => setUser(prev => ({ ...prev, ...res.data }))).catch(() => {});
      } catch {
        // Si Spring Boot indisponible : la progression sera récupérée au prochain chargement via API
        console.warn('[ExerciseSession] completeLevel API indisponible — progression non persistée.');
      }

      setPhase('done');
    } else {
      setCurrentIdx(i => i+1);
      setAttemptCount(0);
      setPhase('ready'); setRecState('idle');
      setResult(null); setAudioUrl(null);
      capturedBlobRef.current = null; setError(null);
      setPhraseIpa(null); // reset so IPA re-fetches for next phrase if toggle is on
    }
  };

  // ── ERROR (no phrases loaded) ──
  if (phase === 'error') return (
    <Layout title={t.pageTitle(level)}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&display=swap');*{font-family:'Nunito',sans-serif;}`}</style>
      <div style={{minHeight:'60vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'20px',textAlign:'center',padding:'0 20px'}}>
        <div style={{fontSize:'64px'}}>⚠️</div>
        <div style={{fontWeight:900,fontSize:'20px',color:'#C8305A'}}>{t.serverError}</div>
        <div style={{fontSize:'14px',color:'#6B7280',maxWidth:'320px',lineHeight:1.6}}>
          {error || t.serverError}
        </div>
        <button onClick={() => { setError(null); setPhase('loading'); }} style={{
          padding:'12px 24px',borderRadius:'14px',border:'none',
          background:`linear-gradient(135deg,${cfg.color},${cfg.colorDark})`,
          fontWeight:900,fontSize:'14px',cursor:'pointer',color:'white',
          boxShadow:`0 4px 0 ${cfg.colorDark}`,
        }}>{t.retry2}</button>
        <button onClick={() => navigate('/exercises')} style={{
          padding:'10px 20px',borderRadius:'14px',border:'2px solid #E5E7EB',
          background:'white',fontWeight:900,fontSize:'13px',cursor:'pointer',color:'#374151',
        }}>{t.backLevels}</button>
      </div>
    </Layout>
  );

  // ── LOADING ──
  if (phase === 'loading') return (
    <Layout title={t.pageTitle(level)}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&display=swap');*{font-family:'Nunito',sans-serif;}`}</style>
      <div style={{minHeight:'60vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'20px'}}>
        <div style={{
          width:'80px',height:'80px',borderRadius:'24px',
          display:'flex',alignItems:'center',justifyContent:'center',
          background:`linear-gradient(135deg,${cfg.color},${cfg.colorDark})`,
          boxShadow:`0 8px 24px ${cfg.color}55`,
          animation:'spin 2s linear infinite',
        }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="2" width="6" height="12" rx="3"/>
            <path d="M5 10a7 7 0 0 0 14 0"/>
            <line x1="12" y1="19" x2="12" y2="22"/>
            <line x1="9" y1="22" x2="15" y2="22"/>
          </svg>
        </div>
        <div style={{textAlign:'center'}}>
          <div style={{fontWeight:900,fontSize:'20px',color:'#1F2937',marginBottom:'6px'}}>
            {t.loading}
          </div>
          <div style={{fontSize:'12px',color:'#9CA3AF'}}>
            {t.loadingSub} <strong style={{color:cfg.color}}>{level}</strong>
          </div>
        </div>
        <div style={{width:'200px',height:'6px',background:'#F3F4F6',borderRadius:'99px',overflow:'hidden'}}>
          <div style={{height:'100%',borderRadius:'99px',background:cfg.color,animation:'progress 1.5s ease-in-out infinite'}} />
        </div>
      </div>
      <style>{`
        @keyframes spin{0%{transform:rotate(0deg) scale(1)}50%{transform:rotate(10deg) scale(1.05)}100%{transform:rotate(0deg) scale(1)}}
        @keyframes progress{0%{width:0%}50%{width:80%}100%{width:100%}}
      `}</style>
    </Layout>
  );

  // ── DONE ──
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : 0;
  const LEVELS_ORDER_DONE = ['A1','A2','B1','B2','C1','C2'];
  const nextLevel = LEVELS_ORDER_DONE[LEVELS_ORDER_DONE.indexOf(level) + 1];
  if (phase === 'done') return (
    <Layout title={t.pageTitleDone(level)}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&display=swap');*{font-family:'Nunito',sans-serif;}
        @keyframes unlockPop{0%{transform:scale(0.8);opacity:0}60%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}
        .unlock-anim{animation:unlockPop 0.6s ease both}
      `}</style>
      <div style={{maxWidth:'480px',margin:'0 auto',paddingBottom:'40px'}}>
        {/* Result hero */}
        <div style={{
          borderRadius:'24px',padding:'32px',textAlign:'center',color:'white',marginBottom:'20px',
          background:`linear-gradient(135deg,${cfg.colorDark},${cfg.color})`,
          boxShadow:`0 12px 40px ${cfg.color}50`,
        }}>
          <div style={{fontSize:'64px',marginBottom:'12px'}}>{avgScore>=60?'🏆':'💪'}</div>
          <div style={{fontWeight:900,fontSize:'26px',marginBottom:'6px'}}>
            {avgScore>=60 ? t.mastered : t.done}
          </div>
          <div style={{opacity:0.8,fontSize:'13px',marginBottom:'24px'}}>
            {nextLevel ? t.unlocked(nextLevel) : t.maxLevel}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'12px',background:'rgba(255,255,255,0.15)',borderRadius:'16px',padding:'16px'}}>
            {[
              {val:`${avgScore}%`, label:t.avgScore},
              {val:`+${sessionXP}`, label:t.xpEarned},
              {val:scores.length, label:t.phrases},
            ].map((s,i) => (
              <div key={i}><div style={{fontWeight:900,fontSize:'22px'}}>{s.val}</div><div style={{opacity:0.7,fontSize:'10px'}}>{s.label}</div></div>
            ))}
          </div>
        </div>

        {/* Score breakdown */}
        <div style={{background:'white',borderRadius:'20px',padding:'20px',marginBottom:'16px',boxShadow:'0 2px 12px rgba(0,0,0,0.06)'}}>
          <div style={{fontWeight:900,fontSize:'14px',color:'#374151',marginBottom:'12px'}}>{t.scoresTitle}</div>
          {scores.map((s,i) => (
            <div key={i} style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'8px'}}>
              <span style={{fontSize:'10px',color:'#9CA3AF',width:'60px',flexShrink:0}}>{t.phraseLabel(i)}</span>
              <div style={{flex:1,height:'8px',background:'#F3F4F6',borderRadius:'99px',overflow:'hidden'}}>
                <div style={{
                  height:'100%',borderRadius:'99px',transition:'width 0.6s ease',
                  width:`${s}%`,
                  background: s>=80?'#80DCDC':s>=60?'#6BACD4':s>=40?'#E8926A':'#E8476A',
                }} />
              </div>
              <span style={{fontSize:'11px',fontWeight:800,width:'30px',textAlign:'right',color:s>=80?'#4DBFBF':s>=60?'#4A90BD':s>=40?'#D47A52':'#C8305A'}}>{s}</span>
            </div>
          ))}
        </div>

        {/* Buttons */}
        <div style={{display:'flex',gap:'10px'}}>
          <button onClick={() => navigate('/exercises')} style={{
            flex:1, padding:'14px', borderRadius:'14px', border:'2px solid #E5E7EB',
            background:'white', fontWeight:900, fontSize:'14px', cursor:'pointer', color:'#374151',
          }}>{t.back}</button>
          <button onClick={() => {
            // Clear cache so Replay generates fresh phrases
            try { localStorage.removeItem(`ex_phrases_${lang}_${level}`); } catch {}
            setCurrentIdx(0);setAttemptCount(0);setScores([]);setLives(LIVES_MAX);setStreak(0);setSessionXP(0);setResult(null);setPhase('loading');
          }} style={{
            flex:1, padding:'14px', borderRadius:'14px', border:'none',
            background:`linear-gradient(135deg,${cfg.color},${cfg.colorDark})`,
            fontWeight:900, fontSize:'14px', cursor:'pointer', color:'white',
            boxShadow:`0 4px 0 ${cfg.colorDark}`,
          }}>{t.replay}</button>
        </div>
        {/* Unlock banner */}
        {nextLevel && (
          <div className="unlock-anim" style={{
            marginTop:'10px', padding:'18px', borderRadius:'16px',
            background:'linear-gradient(135deg,#F0C85A,#B89B30)',
            textAlign:'center', boxShadow:'0 4px 0 #9A8020',
          }}>
            <div style={{fontSize:'28px',marginBottom:'4px'}}>🔓</div>
            <div style={{fontWeight:900,fontSize:'16px',color:'white',marginBottom:'2px'}}>
              {t.unlockedBanner(nextLevel)}
            </div>
            <div style={{fontSize:'12px',color:'rgba(255,255,255,0.8)',marginBottom:'12px'}}>
              {t.unlockedSub(nextLevel)}
            </div>
            <button onClick={() => navigate('/exercises')} style={{
              padding:'10px 24px', borderRadius:'12px', border:'none',
              background:'white', fontWeight:900, fontSize:'13px', cursor:'pointer',
              color:'#B89B30',
            }}>{t.seeAll}</button>
          </div>
        )}
      </div>
    </Layout>
  );

  // ── MAIN SESSION ──
  return (
    <Layout title={t.pageTitleActive(level, cfg.label)}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&display=swap');
        *{font-family:'Nunito','Segoe UI',sans-serif;}
        @keyframes pop{0%{transform:scale(1)}50%{transform:scale(1.08)}100%{transform:scale(1)}}
        @keyframes slideUp{from{transform:translateY(12px);opacity:0}to{transform:translateY(0);opacity:1}}
        .pop{animation:pop 0.3s ease}
        .slide-up{animation:slideUp 0.3s ease both}
      `}</style>

      <div style={{maxWidth:'560px',margin:'0 auto',paddingBottom:'40px'}}>

        {/* TOP BAR */}
        <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'16px'}}>
          <button onClick={() => navigate('/exercises')} style={{
            width:'38px',height:'38px',borderRadius:'12px',border:'2px solid #E5E7EB',
            background:'white',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',
            boxShadow:'0 2px 0 #E5E7EB',
          }}>
            <ArrowLeft size={16} color="#6B7280" />
          </button>

          {/* Progress bar */}
          <div style={{flex:1,position:'relative'}}>
            <div style={{height:'16px',background:'#F3F4F6',borderRadius:'99px',overflow:'hidden',border:'2px solid #E5E7EB'}}>
              <div style={{
                height:'100%',borderRadius:'99px',transition:'width 0.6s ease',
                width:`${(currentIdx / TOTAL) * 100}%`,
                background:`linear-gradient(90deg,${cfg.color},${cfg.colorDark})`,
              }} />
            </div>
            <div style={{position:'absolute',right:'8px',top:'50%',transform:'translateY(-50%)',fontSize:'9px',fontWeight:900,color:cfg.colorDark}}>
              {currentIdx}/{TOTAL}
            </div>
          </div>

          {/* Lives */}
          <LivesRow lives={lives} maxLives={LIVES_MAX} />

          {/* XP */}
          <div style={{
            display:'flex',alignItems:'center',gap:'4px',padding:'5px 10px',
            background:cfg.colorSoft, borderRadius:'12px', border:`2px solid ${cfg.color}`,
          }}>
            <span style={{fontSize:'12px'}}>⚡</span>
            <span style={{fontSize:'11px',fontWeight:900,color:cfg.colorDark}}>{sessionXP}</span>
          </div>
        </div>

        {/* STREAK banner */}
        {streak >= 2 && (
          <div className="slide-up" style={{
            display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',
            padding:'10px',borderRadius:'14px',marginBottom:'12px',
            background:'linear-gradient(135deg,#E8926A,#D47A52)',color:'white',
            boxShadow:'0 4px 0 #B85A32',
          }}>
            <span style={{fontSize:'20px'}}>🔥</span>
            <span style={{fontWeight:900,fontSize:'14px'}}>{t.streak(streak)}</span>
          </div>
        )}

        {/* PHRASE CARD */}
        <div className="slide-up" style={{
          borderRadius:'20px',padding:'24px',marginBottom:'16px',
          background: phase==='result' ? 'white' : cfg.colorSoft,
          border:`3px solid ${cfg.color}`,
          boxShadow:`0 4px 0 ${cfg.colorDark}, 0 8px 24px ${cfg.color}20`,
        }}>
          {/* Level badge */}
          <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'14px'}}>
            <div style={{
              width:'32px',height:'32px',borderRadius:'10px',
              background:`linear-gradient(135deg,${cfg.color},${cfg.colorDark})`,
              display:'flex',alignItems:'center',justifyContent:'center',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="2" width="6" height="12" rx="3"/>
                <path d="M5 10a7 7 0 0 0 14 0"/>
                <line x1="12" y1="19" x2="12" y2="22"/>
                <line x1="9" y1="22" x2="15" y2="22"/>
              </svg>
            </div>
            <span style={{fontSize:'12px',fontWeight:900,color:cfg.colorDark,textTransform:'uppercase',letterSpacing:'0.05em'}}>
              {t.pronounce}
            </span>
            <div style={{marginLeft:'auto',fontSize:'11px',fontWeight:700,color:cfg.color}}>
              #{currentIdx + 1}
            </div>
          </div>

          {/* Phrase or colored words */}
          {phase === 'result' && result?.ops ? (
            <div style={{display:'flex',flexWrap:'wrap',alignItems:'flex-start',minHeight:'52px'}}>
              {result.ops.map((op, i) => {
                const ipaEntry = phraseIpa?.find(p => p.word?.toLowerCase() === (op.expected || '').toLowerCase());
                // Whisper hallucinated → all words were "missed", not pronounced
                const effectiveOp = result.suspected_hallucination ? 'DEL' : op.op;
                return <WordToken key={i} word={op.expected || op.got || ''} op={effectiveOp} spoken={op.got} ipa={ipaEntry?.ipa} />;
              })}
            </div>
          ) : (
            <div style={{
              fontSize:'20px',fontWeight:900,lineHeight:1.4,
              fontStyle: phase==='loading' ? 'italic' : 'normal',
              color: phase==='loading' ? '#9CA3AF' : '#1F2937',
            }}>
              "{currentPhrase || (lang === 'en' ? 'Loading...' : 'Chargement...')}"
            </div>
          )}

          {/* IPA phonetics toggle — only shown during ready/recorded phases */}
          {['ready', 'recorded'].includes(phase) && (
            <div style={{marginTop:10}}>
              {showIpa && phraseIpa?.length > 0 && (
                <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:8,padding:'8px 12px',background:'rgba(56,189,248,.06)',borderRadius:10,border:'1px solid rgba(56,189,248,.18)'}}>
                  {phraseIpa.map((p, i) => (
                    <span key={i} style={{display:'inline-flex',flexDirection:'column',alignItems:'center',padding:'2px 4px'}}>
                      <span style={{fontSize:'12px',fontWeight:700,color:'#374151'}}>{p.word}</span>
                      <span style={{fontSize:'8.5px',color:'#38bdf8',fontFamily:'monospace',fontWeight:700,letterSpacing:'.5px'}}>/{p.ipa}/</span>
                    </span>
                  ))}
                </div>
              )}
              <button onClick={() => setShowIpa(v => !v)} style={{
                fontSize:'9px',fontWeight:900,color:'#38bdf8',
                background:'rgba(56,189,248,.08)',border:'1px solid rgba(56,189,248,.25)',
                borderRadius:999,padding:'3px 10px',cursor:'pointer',letterSpacing:'.04em',textTransform:'uppercase',
              }}>
                {showIpa ? `🔬 ${t.hideIpa}` : `🔬 ${t.showIpa}`}
              </button>
            </div>
          )}

          {/* Transcription */}
          {phase==='result' && result?.transcript && (
            <div style={{marginTop:'14px',paddingTop:'14px',borderTop:'1px dashed #E5E7EB'}}>
              <div style={{fontSize:'10px',color:'#9CA3AF',fontWeight:700,marginBottom:'4px'}}>{t.youSaid}</div>
              <div style={{fontSize:'13px',color:'#6B7280',fontStyle:'italic'}}>"{result.transcript}"</div>
            </div>
          )}
        </div>

        {/* COLOR LEGEND + ATTEMPT COUNTER */}
        {phase==='result' && (
          <div className="slide-up" style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'8px',marginBottom:'12px'}}>
            <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
              {[
                {color:'#22C55E',bg:'#DCFCE7',label:t.correct},
                {color:'#EF4444',bg:'#FEE2E2',label:t.wrong},
                {color:'#F97316',bg:'#FFEDD5',label:t.omit},
              ].map(l => (
                <div key={l.label} style={{
                  display:'flex',alignItems:'center',gap:'5px',padding:'4px 10px',
                  borderRadius:'20px',background:l.bg,border:`1.5px solid ${l.color}`,
                }}>
                  <div style={{width:'8px',height:'8px',borderRadius:'50%',background:l.color}} />
                  <span style={{fontSize:'10px',fontWeight:800,color:l.color}}>{l.label}</span>
                </div>
              ))}
            </div>
            <div style={{fontSize:'11px',fontWeight:800,color:'#9CA3AF',padding:'4px 10px',background:'#F3F4F6',borderRadius:'20px'}}>
              {t.attempt(attemptCount + 1, MAX_ATTEMPTS)}
            </div>
          </div>
        )}

        {/* SCORE BANNER */}
        {phase==='result' && result && (
          <div className={`slide-up ${showResultAnim?'pop':''}`} style={{marginBottom:'12px'}}>
            <ScoreBanner score={result.score} xp={result.xp_earned || 5} lang={lang} />
          </div>
        )}

        {/* HALLUCINATION WARNING — Whisper a complété la phrase automatiquement */}
        {phase==='result' && result?.suspected_hallucination && (
          <div className="slide-up" style={{
            background:'#FFFBEB', border:'2px solid #FDE68A', borderRadius:'14px',
            padding:'12px 16px', marginBottom:'12px',
            display:'flex', alignItems:'flex-start', gap:'10px',
          }}>
            <span style={{fontSize:'18px',flexShrink:0}}>⚠️</span>
            <div>
              <div style={{fontWeight:900,fontSize:'12px',color:'#B45309',marginBottom:'2px'}}>
                {lang==='en' ? 'Phrase not fully pronounced' : 'Phrase non prononcée en entier'}
              </div>
              <div style={{fontSize:'11px',color:'#92400E',lineHeight:1.5}}>
                {lang==='en'
                  ? 'It seems you only said part of the phrase. Try to pronounce the full sentence from start to finish. Score was adjusted.'
                  : "Il semble que tu n'aies prononcé qu'une partie de la phrase. Essaie de dire la phrase entière du début à la fin. Le score a été ajusté."}
              </div>
            </div>
          </div>
        )}

        {/* FEEDBACK */}
        {phase==='result' && result?.feedback && (
          <CoachFeedback
            feedback={result.feedback}
            score={result.score}
            ops={result.ops}
            firstName={user?.firstName || user?.prenom}
            lang={lang}
          />
        )}

        {/* ERROR */}
        {(error || micError) && (
          <div style={{
            background:'#FDE8EE',border:'2px solid #E8476A',borderRadius:'14px',
            padding:'12px 16px',marginBottom:'12px',
            display:'flex',alignItems:'center',gap:'8px',fontSize:'12px',color:'#C8305A',fontWeight:700,
          }}>
            ⚠️ {error || micError}
          </div>
        )}

        {/* RECORDING PANEL */}
        {(phase==='ready' || phase==='recording' || phase==='recorded') && (
          <div style={{
            background:'white',borderRadius:'20px',padding:'24px',
            border:'2px solid #E5E7EB',
            boxShadow:'0 4px 0 #E5E7EB, 0 8px 24px rgba(0,0,0,0.05)',
          }}>
            {typeof WaveVisualizer !== 'undefined' && (
              <div style={{marginBottom:'16px'}}>
                <WaveVisualizer isActive={isRecording} audioLevel={audioLevel} />
              </div>
            )}

            {recState === 'idle' && (
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'12px'}}>
                {typeof MicButton !== 'undefined' ? (
                  <MicButton isRecording={false} onClick={handleStartRec} />
                ) : (
                  <button onClick={handleStartRec} style={{
                    width:'80px',height:'80px',borderRadius:'50%',border:'none',cursor:'pointer',
                    background:`linear-gradient(135deg,${cfg.color},${cfg.colorDark})`,
                    fontSize:'32px',boxShadow:`0 6px 0 ${cfg.colorDark}`,color:'white',
                  }}>🎤</button>
                )}
                <div style={{fontSize:'12px',color:'#9CA3AF',fontWeight:700}}>{t.record}</div>
              </div>
            )}

            {recState === 'recording' && (
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'12px'}}>
                {typeof MicButton !== 'undefined' ? (
                  <MicButton isRecording={true} onClick={handleStopRec} />
                ) : (
                  <button onClick={handleStopRec} style={{
                    width:'80px',height:'80px',borderRadius:'50%',border:'none',cursor:'pointer',
                    background:'linear-gradient(135deg,#E8476A,#C8305A)',
                    fontSize:'32px',boxShadow:'0 6px 0 #C8305A',animation:'pulse 1s infinite',
                  }}>⏹</button>
                )}
                <div style={{fontSize:'12px',color:'#E8476A',fontWeight:700,animation:'pulse 1s infinite'}}>
                  {t.recording}
                </div>
              </div>
            )}

            {recState === 'recorded' && (
              <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
                {audioUrl && (
                  <div>
                    <div style={{fontSize:'10px',color:'#9CA3AF',fontWeight:700,marginBottom:'6px',textTransform:'uppercase'}}>{t.preview}</div>
                    <audio src={audioUrl} controls style={{width:'100%',height:'36px',borderRadius:'8px'}} />
                  </div>
                )}
                <div style={{display:'flex',gap:'10px'}}>
                  <button onClick={handleReRecord} style={{
                    flex:1, padding:'13px', borderRadius:'14px',
                    border:'2px solid #E5E7EB', background:'white',
                    fontWeight:900, fontSize:'13px', cursor:'pointer', color:'#374151',
                    boxShadow:'0 3px 0 #E5E7EB',
                  }}>
                    {t.reRecord}
                  </button>
                  <button onClick={handleSubmit} style={{
                    flex:1.5, padding:'13px', borderRadius:'14px', border:'none',
                    background:`linear-gradient(135deg,${cfg.color},${cfg.colorDark})`,
                    fontWeight:900, fontSize:'13px', cursor:'pointer', color:'white',
                    boxShadow:`0 4px 0 ${cfg.colorDark}`,
                  }}>
                    {t.analyze}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PROCESSING */}
        {phase === 'processing' && (
          <div style={{
            background:'white',borderRadius:'20px',padding:'40px',
            border:`2px solid ${cfg.color}33`,textAlign:'center',
          }}>
            <style>{`
              @keyframes wave1{0%,100%{transform:scaleY(0.4)}50%{transform:scaleY(1)}}
              @keyframes wave2{0%,100%{transform:scaleY(0.7)}50%{transform:scaleY(0.2)}}
              @keyframes wave3{0%,100%{transform:scaleY(1)}50%{transform:scaleY(0.4)}}
              @keyframes wave4{0%,100%{transform:scaleY(0.3)}50%{transform:scaleY(0.9)}}
              @keyframes wave5{0%,100%{transform:scaleY(0.6)}50%{transform:scaleY(0.1)}}
              @keyframes micPulse{0%,100%{box-shadow:0 0 0 0 ${cfg.color}55}70%{box-shadow:0 0 0 18px ${cfg.color}00}}
            `}</style>
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:16}}>
              {/* Mic icon with pulse ring */}
              <div style={{
                width:64,height:64,borderRadius:'50%',
                background:`linear-gradient(135deg,${cfg.color},${cfg.colorDark})`,
                display:'flex',alignItems:'center',justifyContent:'center',
                animation:'micPulse 1.4s ease-out infinite',
                flexShrink:0,
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="2" width="6" height="12" rx="3"/>
                  <path d="M5 10a7 7 0 0 0 14 0"/>
                  <line x1="12" y1="19" x2="12" y2="22"/>
                  <line x1="9" y1="22" x2="15" y2="22"/>
                </svg>
              </div>
              {/* Audio bars */}
              <div style={{display:'flex',alignItems:'center',gap:4,height:32}}>
                {[
                  {anim:'wave1',delay:'0s'},
                  {anim:'wave2',delay:'0.15s'},
                  {anim:'wave3',delay:'0.3s'},
                  {anim:'wave4',delay:'0.45s'},
                  {anim:'wave5',delay:'0.6s'},
                  {anim:'wave3',delay:'0.75s'},
                  {anim:'wave1',delay:'0.9s'},
                ].map((b,i) => (
                  <div key={i} style={{
                    width:4,height:32,borderRadius:999,
                    background:cfg.color,
                    animation:`${b.anim} 0.9s ease-in-out infinite`,
                    animationDelay:b.delay,
                    transformOrigin:'center',
                  }}/>
                ))}
              </div>
              <div>
                <div style={{fontWeight:900,fontSize:'14px',color:'#374151',marginBottom:'4px'}}>{t.processing}</div>
                <div style={{fontSize:'11px',color:'#9CA3AF'}}>{t.processSub}</div>
              </div>
            </div>
          </div>
        )}

        {/* NEXT BUTTON */}
        {phase === 'result' && (
          <div style={{display:'flex',gap:'10px',marginTop:'4px'}}>
            {attemptCount < MAX_ATTEMPTS - 1 ? (
              <button onClick={handleReRecord} style={{
                padding:'13px 16px', borderRadius:'14px',
                border:'2px solid #E5E7EB', background:'white',
                fontWeight:900, fontSize:'12px', cursor:'pointer', color:'#374151',
                boxShadow:'0 3px 0 #E5E7EB', whiteSpace:'nowrap',
              }}>{t.retry(MAX_ATTEMPTS - 1 - attemptCount)}</button>
            ) : (
              <div style={{padding:'13px 16px',borderRadius:'14px',background:'#FEE2E2',border:'2px solid #EF4444',fontSize:'11px',fontWeight:800,color:'#B91C1C',display:'flex',alignItems:'center',gap:'4px'}}>
                {t.maxAttempts}
              </div>
            )}
            <button onClick={handleNext} style={{
              flex:1, padding:'14px', borderRadius:'14px', border:'none',
              background:`linear-gradient(135deg,${cfg.color},${cfg.colorDark})`,
              fontWeight:900, fontSize:'15px', cursor:'pointer', color:'white',
              boxShadow:`0 5px 0 ${cfg.colorDark}`,
              display:'flex', alignItems:'center', justifyContent:'center', gap:'8px',
            }}>
              {currentIdx + 1 >= TOTAL ? <><Trophy size={18}/> {t.results}</> : <>{t.next} <ChevronRight size={18}/></>}
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.6}}
        @keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
      `}</style>
    </Layout>
  );
}