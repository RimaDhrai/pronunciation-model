import { useState, useEffect, useCallback } from 'react';
import Layout from '../components/layout/Layout';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  TrendingUp, TrendingDown, Minus,
  Target, Mic, Calendar,
  CheckCircle, BarChart3
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getSessions, getCefrHistory } from '../api/auth';
const SCORE_CONFIG = (score, lang = 'fr') =>
  score >= 85 ? { color: '#80DCDC', bg: '#E8F9F9', border: '#80DCDC', label: lang === 'en' ? 'Excellent' : 'Excellent', icon: '🏆' }
  : score >= 70 ? { color: '#6BACD4', bg: '#EBF4FB', border: '#6BACD4', label: lang === 'en' ? 'Very good' : 'Très bien', icon: '👍' }
  : score >= 55 ? { color: '#9580D4', bg: '#F3F0FE', border: '#9580D4', label: lang === 'en' ? 'Good' : 'Bien', icon: '💪' }
  : score >= 40 ? { color: '#E8926A', bg: '#FEF3EC', border: '#E8926A', label: lang === 'en' ? 'Passable' : 'Passable', icon: '🔄' }
  : { color: '#D46A60', bg: '#FEF0EE', border: '#D46A60', label: lang === 'en' ? 'To improve' : 'À améliorer', icon: '💫' };

function ScoreMini({ score, size = 52 }) {
  const cfg = SCORE_CONFIG(score);
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f0e8e0" strokeWidth={5} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={cfg.color} strokeWidth={5}
        strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} />
      <text x="50%" y="54%" textAnchor="middle" dominantBaseline="middle"
        fontSize={size * 0.22} fontWeight="900" fill={cfg.color}>{score}</text>
    </svg>
  );
}

const BADGE_CONFIG = {
  FIRST_STEP:    { icon: '🎯', label: 'Premier pas',      color: '#80DCDC' },
  STREAK_3:      { icon: '🔥', label: '3 jours de suite', color: '#E8926A' },
  STREAK_7:      { icon: '💎', label: 'Semaine parfaite', color: '#9580D4' },
  STREAK_30:     { icon: '👑', label: 'Mois parfait',     color: '#F0C85A' },
  PERFECT_SCORE: { icon: '⭐', label: 'Score parfait',    color: '#F0C85A' },
  EXCELLENCE:    { icon: '🏆', label: 'Excellence 90+',   color: '#80DCDC' },
  XP_100:        { icon: '⚡', label: '100 XP',           color: '#6BACD4' },
  XP_500:        { icon: '🚀', label: '500 XP',           color: '#9580D4' },
  XP_1000:       { icon: '💫', label: '1000 XP',          color: '#F0C85A' },
};

const UI = {
  fr: {
    title: 'Mon Parcours',
    myReports: 'MON PARCOURS',
    sessions: (n) => `${n} session${n > 1 ? 's' : ''} d'entraînement`,
    filterAll: 'Toutes', filterWeek: 'Semaine', filterMonth: 'Mois',
    noSession: 'Aucune session',
    selectPrompt: 'Sélectionne une session pour voir les détails',
    phraseLabel: 'Phrase évaluée',
    noReport: 'Aucun historique disponible',
    noReportSub: 'Complète un diagnostic ou un exercice pour voir ton parcours.',
    startEx: 'Démarrer un exercice',
    gamification: 'Gamification & Progression',
    streak: (n) => `${n} jour${n !== 1 ? 's' : ''} de suite`,
    record: (n) => `Record : ${n} jours`,
    badgeEmpty: 'Complète des exercices pour débloquer des badges !',
    cefrHistory: 'Historique des tests CEFR',
    cefrDone: 'Terminé', cefrCancelled: 'Annulé', cefrOngoing: 'En cours',
    nextMilestone: 'prochain palier',
  },
  en: {
    title: 'My Journey',
    myReports: 'MY JOURNEY',
    sessions: (n) => `${n} training session${n > 1 ? 's' : ''}`,
    filterAll: 'All', filterWeek: 'Week', filterMonth: 'Month',
    noSession: 'No session',
    selectPrompt: 'Select a session to see details',
    phraseLabel: 'Evaluated phrase',
    noReport: 'No history yet',
    noReportSub: 'Complete a diagnostic or exercise to see your journey.',
    startEx: 'Start an exercise',
    gamification: 'Gamification & Progress',
    streak: (n) => `${n} day${n !== 1 ? 's' : ''} in a row`,
    record: (n) => `Record: ${n} days`,
    badgeEmpty: 'Complete exercises to unlock badges!',
    cefrHistory: 'CEFR Test History',
    cefrDone: 'Completed', cefrCancelled: 'Cancelled', cefrOngoing: 'Ongoing',
    nextMilestone: 'next milestone',
  }
};

export default function Reports() {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const ui = UI[lang] || UI.fr;
  const [sessions, setSessions]     = useState([]);
  const [selected, setSelected]     = useState(null);
  const [filter, setFilter]         = useState('all');
  const [cefrTests, setCefrTests]   = useState([]);

  // Parse any date string into a JS Date object
  const parseDate = (d) => {
    if (!d) return null;
    // ISO datetime: 2026-04-30T10:30:00 or 2026-04-30
    if (d.includes('-')) {
      const parsed = new Date(d);
      if (!isNaN(parsed)) return parsed;
    }
    // DD/MM/YYYY
    const parts = d.split('/');
    if (parts.length === 3) {
      const parsed = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
      if (!isNaN(parsed)) return parsed;
    }
    return null;
  };

  // Format a date string for display as DD/MM/YYYY
  const fmtDisplay = (d) => {
    const parsed = parseDate(d);
    if (!parsed) return d || '';
    const dd = String(parsed.getDate()).padStart(2, '0');
    const mm = String(parsed.getMonth() + 1).padStart(2, '0');
    const yy = parsed.getFullYear();
    return `${dd}/${mm}/${yy}`;
  };

  const reload = useCallback(() => {
    getSessions()
      .then((res) => {
        const raw = Array.isArray(res.data) ? res.data : [];
        const all = raw.map(s => ({ ...s, rawDate: s.date, date: fmtDisplay(s.date) }));
        setSessions(all);
        if (all.length > 0) setSelected(s => s ?? all[0]);
      })
      .catch(() => setSessions([]));
  }, []);

  useEffect(() => {
    reload();
    getCefrHistory()
      .then(res => setCefrTests(Array.isArray(res.data) ? res.data : []))
      .catch(() => setCefrTests([]));
  }, [reload]);

  const now = new Date();
  const filtered = sessions.filter((s) => {
    if (filter === 'all') return true;
    const d = parseDate(s.rawDate || s.date);
    if (!d) return true;
    if (filter === 'week') {
      const diffDays = (now - d) / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays <= 7;
    }
    if (filter === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    return true;
  });

  const scores    = sessions.map(s => s.score ?? 0).filter(n => n > 0);
  const avgScore  = scores.length ? Math.round(scores.reduce((a,b) => a+b, 0) / scores.length) : 0;
  const recent5   = scores.slice(-5);
  const recentAvg = recent5.length ? Math.round(recent5.reduce((a,b) => a+b,0) / recent5.length) : 0;
  const trend = recentAvg > avgScore + 3 ? 'up' : recentAvg < avgScore - 3 ? 'down' : 'stable';

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? '#80DCDC' : trend === 'down' ? '#D46A60' : '#9580D4';
  const trendLabel = trend === 'up' ? lang === 'fr' ? 'En progression' : 'Improving'
                   : trend === 'down' ? lang === 'fr' ? 'En baisse' : 'Declining'
                   : lang === 'fr' ? 'Stable' : 'Stable';

  if (sessions.length === 0) {
    return (
      <Layout title={ui.title}>
        <style>{`
          .rpt-card { background:white; border-radius:2rem; border:2px solid #f0e8e0; border-bottom:5px solid #e0d8d0; padding:1.5rem; box-shadow:0 4px 12px rgba(28,43,58,0.05); }
        `}</style>
        <div className="max-w-lg mx-auto py-20 px-4 text-center animate-fade-up">
          <div className="rpt-card flex flex-col items-center gap-6 py-16">
            <div style={{width:72,height:72,borderRadius:'50%',background:'hsla(var(--primary), 0.1)',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <BarChart3 style={{width:32,height:32,color:'hsl(var(--primary))',opacity:0.6}} />
            </div>
            <div>
              <h3 className="text-foreground" style={{fontWeight:900,fontSize:'1.3rem',margin:'0 0 8px'}}>
                {ui.noReport}
              </h3>
              <p className="text-muted-foreground" style={{fontWeight:700,margin:0,maxWidth:320}}>
                {ui.noReportSub}
              </p>
            </div>
            <Link to="/exercises" className="duo-button-blue" style={{textDecoration:'none',fontSize:'0.8rem'}}>
              {ui.startEx}
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={ui.title}>
      <style>{`
        .rpt-card { background: var(--card); border-radius:2rem; border:2px solid var(--border); border-bottom:5px solid var(--border); padding:1.5rem; box-shadow:0 4px 12px rgba(28,43,58,0.05); transition:transform .2s; color: var(--foreground); }
        .rpt-card:hover { transform:translateY(-2px); }
        .rpt-row { padding:10px 12px; border-radius:1rem; cursor:pointer; transition:all .15s; border:2px solid transparent; }
        .rpt-row:hover { background: var(--muted); }
        .rpt-row.active { background: hsla(var(--primary), 0.1); border-color: hsla(var(--primary), 0.3); }
        .rpt-filter { flex:1; padding:7px 4px; border-radius:.75rem; font-size:.7rem; font-weight:900; transition:all .15s; background:none; border:none; cursor:pointer; text-transform:uppercase; letter-spacing:.06em; }
        .rpt-filter.active { background: var(--card); box-shadow:0 2px 8px rgba(0,0,0,.07); color: var(--foreground); }
        .rpt-filter:not(.active) { color: var(--muted-foreground); }
      `}</style>

      <div className="max-w-6xl mx-auto animate-fade-up space-y-6">

        {/* ── Stats summary header (Ascent style) ── */}
        <div className="bg-card" style={{borderRadius:'2.5rem',border:'2px solid var(--border)',borderBottom:'8px solid var(--border)',padding:'2rem 2.5rem',position:'relative',overflow:'hidden',boxShadow:'0 8px 32px -8px rgba(28,43,58,0.08)'}}>
          <div style={{position:'absolute',width:180,height:180,borderRadius:'50%',border:'4px solid #E8476A',opacity:.1,top:-70,right:60,pointerEvents:'none'}} />
          <div style={{position:'absolute',width:14,height:14,border:'3px solid #F0C85A',transform:'rotate(45deg)',opacity:.45,top:24,right:90,pointerEvents:'none'}} />
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:16,position:'relative',zIndex:1}}>
            <div>
              <div style={{display:'inline-flex',alignItems:'center',gap:6,background:'hsla(var(--primary), 0.12)',borderRadius:999,padding:'4px 14px',marginBottom:10,fontSize:11,fontWeight:900,letterSpacing:'0.1em',color:'hsl(var(--primary))',textTransform:'uppercase',border:'1px solid hsla(var(--primary), 0.25)'}}>
                {ui.myReports}
              </div>
              <h2 className="text-foreground" style={{fontWeight:900,fontSize:'1.8rem',margin:'0 0 4px'}}>
                {ui.sessions(sessions.length)}
              </h2>
              {scores.length > 1 && (
                <div style={{display:'flex',alignItems:'center',gap:6,color:trendColor,fontWeight:900,fontSize:'0.72rem',textTransform:'uppercase'}}>
                  <TrendIcon style={{width:14,height:14}} />{trendLabel}
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'280px 1fr',gap:24,alignItems:'start'}}>

          {/* ── Session list ── */}
          <div className="rpt-card" style={{position:'sticky',top:80}}>
            {/* Filter tabs */}
            <div style={{display:'flex',background:'#F5F7FF',borderRadius:'.75rem',padding:4,marginBottom:12}}>
              {[['all',ui.filterAll],['week',ui.filterWeek],['month',ui.filterMonth]].map(([k,l]) => (
                <button key={k} onClick={() => setFilter(k)}
                  className={`rpt-filter ${filter===k?'active':''}`}>{l}</button>
              ))}
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:4,maxHeight:460,overflowY:'auto',paddingRight:2}}>
              {filtered.length === 0
                ? <p style={{textAlign:'center',color:'#5F7183',fontWeight:700,fontSize:'0.7rem',padding:'16px 0'}}>{ui.noSession}</p>
                : filtered.map((r, idx) => {
                    const cfg = SCORE_CONFIG(r.score ?? 0);
                    return (
                      <div key={idx} onClick={() => setSelected(r)}
                        className={`rpt-row ${selected === r ? 'active' : ''}`}
                        style={{display:'flex',alignItems:'center',gap:10}}>
                        <ScoreMini score={r.score ?? 0} size={44} />
                        <div style={{flex:1,minWidth:0}}>
                          <p style={{fontWeight:900,color:'#1C2B3A',fontSize:'0.72rem',textTransform:'uppercase',margin:'0 0 2px',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                            {r.type || 'Prononciation'}
                          </p>
                          <p style={{fontWeight:700,fontSize:'0.58rem',color:'#5F7183',textTransform:'uppercase',margin:0}}>
                            {r.date} · {r.level || ''}
                          </p>
                        </div>
                        <span style={{fontSize:'0.6rem',fontWeight:900,color:cfg.color,background:cfg.bg,padding:'2px 8px',borderRadius:999,border:`1.5px solid ${cfg.border}30`,whiteSpace:'nowrap'}}>
                          {cfg.label}
                        </span>
                      </div>
                    );
                  })
              }
            </div>
          </div>

          {/* ── Session detail + AI analysis ── */}
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            {selected ? (
              <>
                {/* Session header */}
                <div className="rpt-card" style={{padding:'1.25rem 1.5rem'}}>
                  {(() => {
                    const cfg = SCORE_CONFIG(selected.score ?? 0);
                    const pct = selected.score ?? 0;
                    const circ = 2 * Math.PI * 52;
                    return (
                      <div style={{display:'flex',alignItems:'center',gap:20,flexWrap:'wrap'}}>
                        {/* Big score ring */}
                        <svg width={120} height={120} style={{flexShrink:0}}>
                          <circle cx={60} cy={60} r={52} fill="none" stroke="#f0e8e0" strokeWidth={10} />
                          <circle cx={60} cy={60} r={52} fill="none" stroke={cfg.color} strokeWidth={10}
                            strokeDasharray={`${(pct/100)*circ} ${circ-(pct/100)*circ}`} strokeLinecap="round"
                            transform="rotate(-90 60 60)" style={{transition:'stroke-dasharray .8s'}} />
                          <text x="50%" y="47%" textAnchor="middle" dominantBaseline="middle"
                            fontSize="22" fontWeight="900" fill={cfg.color}>{pct}</text>
                          <text x="50%" y="63%" textAnchor="middle" dominantBaseline="middle"
                            fontSize="9" fontWeight="900" fill="#5F7183">/ 100</text>
                        </svg>
                        <div style={{flex:1}}>
                          <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:8}}>
                            <span style={{background:cfg.bg,color:cfg.color,fontWeight:900,fontSize:'0.65rem',padding:'4px 10px',borderRadius:999,border:`1.5px solid ${cfg.border}30`}}>
                              {cfg.icon} {cfg.label}
                            </span>
                            {selected.lang && <span style={{background:'#EBF4FB',color:'#4A90BD',fontWeight:900,fontSize:'0.65rem',padding:'4px 10px',borderRadius:999}}>{selected.lang.toUpperCase()}</span>}
                            {selected.level && <span style={{background:'#F3F0FE',color:'#7D66C0',fontWeight:900,fontSize:'0.65rem',padding:'4px 10px',borderRadius:999}}>{selected.level}</span>}
                          </div>
                          <h3 style={{fontWeight:900,fontSize:'1rem',color:'#1C2B3A',margin:'0 0 4px'}}>
                            {selected.type || 'Prononciation'}
                          </h3>
                          <p style={{color:'#5F7183',fontWeight:700,fontSize:'0.7rem',margin:0,display:'flex',alignItems:'center',gap:5}}>
                            <Calendar style={{width:11,height:11}} />{selected.date}
                          </p>
                          {/* Score bar */}
                          <div style={{marginTop:10,height:8,background:'#f0e8e0',borderRadius:999,overflow:'hidden'}}>
                            <div style={{height:'100%',background:cfg.color,borderRadius:999,width:`${pct}%`,transition:'width .8s'}} />
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Phrase + feedback */}
                {selected.phrase && (
                  <div className="rpt-card" style={{padding:'1.25rem 1.5rem'}}>
                    <p style={{fontWeight:900,fontSize:'0.6rem',textTransform:'uppercase',letterSpacing:'0.1em',color:'#5F7183',margin:'0 0 10px',display:'flex',alignItems:'center',gap:6}}>
                      <Mic style={{width:12,height:12,color:'#6BACD4'}} />{ui.phraseLabel}
                    </p>
                    <div style={{background:'#F5F7FF',borderRadius:'1rem',padding:'12px 16px',border:'2px solid #f0e8e0'}}>
                      <p style={{fontWeight:700,color:'#1C2B3A',fontSize:'0.88rem',fontStyle:'italic',margin:0}}>
                        "{selected.phrase}"
                      </p>
                    </div>
                    {selected.feedback && (
                      <div style={{marginTop:10,display:'flex',alignItems:'flex-start',gap:8,padding:'10px 14px',background:'rgba(128,220,220,0.06)',borderRadius:'1rem',border:'1.5px solid rgba(128,220,220,0.2)'}}>
                        <CheckCircle style={{width:14,height:14,color:'#80DCDC',flexShrink:0,marginTop:2}} />
                        <p style={{color:'#2D6A5A',fontWeight:700,fontSize:'0.78rem',margin:0,lineHeight:1.5}}>{selected.feedback}</p>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="rpt-card" style={{display:'flex',flexDirection:'column',alignItems:'center',padding:'3rem',textAlign:'center'}}>
                <BarChart3 style={{width:40,height:40,color:'#5F7183',opacity:0.3,marginBottom:12}} />
                <p style={{color:'#5F7183',fontWeight:700,fontSize:'0.8rem',margin:0}}>{ui.selectPrompt}</p>
              </div>
            )}

            {/* ── Gamification panel ── */}
            <div className="rpt-card" style={{padding:'1.5rem'}}>
              <p style={{fontWeight:900,fontSize:'0.6rem',textTransform:'uppercase',letterSpacing:'0.1em',color:'#5F7183',margin:'0 0 14px',display:'flex',alignItems:'center',gap:6}}>
                <span style={{fontSize:14}}>🏅</span>{ui.gamification}
              </p>

              {/* Streak info */}
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16,background:'#FEF3EC',borderRadius:'1rem',padding:'10px 14px',border:'1.5px solid rgba(232,146,106,0.25)'}}>
                <span style={{fontSize:22}}>🔥</span>
                <div>
                  <p style={{fontWeight:900,fontSize:'1rem',color:'#E8926A',margin:0}}>{ui.streak(user?.currentStreak ?? 0)}</p>
                  <p style={{fontWeight:700,fontSize:'0.6rem',color:'#9A6040',textTransform:'uppercase',letterSpacing:'0.08em',margin:0}}>{ui.record(user?.longestStreak ?? 0)}</p>
                </div>
              </div>

              {/* XP progress bar */}
              <div style={{marginBottom:16}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                  <span style={{fontWeight:900,fontSize:'0.72rem',color:'#1C2B3A'}}>⚡ {user?.totalXp ?? 0} XP</span>
                  <span style={{fontWeight:700,fontSize:'0.6rem',color:'#5F7183'}}>{ui.nextMilestone} : {[100,500,1000].find(m => m > (user?.totalXp ?? 0)) ?? '1000+'}</span>
                </div>
                <div style={{height:10,background:'#f0e8e0',borderRadius:999,overflow:'hidden',position:'relative'}}>
                  {[100,500,1000].map(milestone => (
                    <div key={milestone} style={{position:'absolute',left:`${Math.min((milestone/1000)*100,100)}%`,top:0,bottom:0,width:2,background:'rgba(255,255,255,0.6)',zIndex:1}} />
                  ))}
                  <div style={{height:'100%',background:'linear-gradient(90deg,#9580D4,#6BACD4)',borderRadius:999,width:`${Math.min(((user?.totalXp ?? 0)/1000)*100,100)}%`,transition:'width .8s'}} />
                </div>
                <div style={{display:'flex',justifyContent:'space-between',marginTop:4}}>
                  {[100,500,1000].map(m => (
                    <span key={m} style={{fontSize:'0.5rem',fontWeight:800,color:(user?.totalXp ?? 0) >= m ? '#9580D4' : '#C0BABA',textTransform:'uppercase'}}>{m}</span>
                  ))}
                </div>
              </div>

              {/* Badges grid */}
              {user?.badges?.length > 0 ? (
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(80px,1fr))',gap:8}}>
                  {user.badges.map((b, i) => {
                    const cfg = BADGE_CONFIG[b.badgeKey] || { icon: '🎖️', label: b.badgeKey, color: '#5F7183' };
                    return (
                      <div key={i} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4,background:'#F8FAFB',borderRadius:'1rem',padding:'10px 6px',border:`1.5px solid ${cfg.color}30`,textAlign:'center'}}>
                        <span style={{fontSize:22}}>{cfg.icon}</span>
                        <span style={{fontWeight:800,fontSize:'0.55rem',color:cfg.color,textTransform:'uppercase',letterSpacing:'0.06em',lineHeight:1.2}}>{cfg.label}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{textAlign:'center',padding:'12px 0',color:'#5F7183'}}>
                  <p style={{fontWeight:700,fontSize:'0.75rem',margin:0}}>{ui.badgeEmpty}</p>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* ── Tests CEFR ── */}
        {cefrTests.length > 0 && (
          <div className="rpt-card">
            <div style={{fontWeight:900,fontSize:'1rem',color:'#1C2B3A',marginBottom:'16px',display:'flex',alignItems:'center',gap:'8px'}}>
              <Target style={{width:18,height:18,color:'#9580D4'}} />
              {ui.cefrHistory}
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
              {cefrTests.slice(0,5).map((t,i) => {
                const lvl = t.finalLevel || '—';
                const lvlColors = {A1:'#80DCDC',A2:'#6BACD4',B1:'#9580D4',B2:'#E8926A',C1:'#E8476A',C2:'#F0C85A'};
                const col = lvlColors[lvl] || '#9CA3AF';
                const date = t.startedAt ? new Date(t.startedAt).toLocaleDateString('fr-FR') : '—';
                return (
                  <div key={i} style={{display:'flex',alignItems:'center',gap:'14px',padding:'12px 14px',borderRadius:'1rem',background:'#F8FAFB',border:'2px solid #f0e8e0'}}>
                    <div style={{width:44,height:44,borderRadius:'12px',background:`${col}15`,border:`2px solid ${col}`,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:'14px',color:col,flexShrink:0}}>
                      {lvl}
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:800,fontSize:'13px',color:'#1C2B3A'}}>Test CEFR — Niveau {lvl}</div>
                      <div style={{fontSize:'11px',color:'#9CA3AF',marginTop:'2px'}}>{date} · {t.status === 'COMPLETED' ? ui.cefrDone : t.status === 'CANCELLED' ? ui.cefrCancelled : ui.cefrOngoing}</div>
                    </div>
                    <div style={{fontWeight:900,fontSize:'13px',color:col,background:`${col}15`,padding:'4px 12px',borderRadius:'8px'}}>
                      {lvl !== '—' ? `Niveau ${lvl}` : '—'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
