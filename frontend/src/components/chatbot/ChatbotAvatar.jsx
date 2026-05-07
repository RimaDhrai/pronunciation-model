import { useState, useRef, useEffect, useCallback } from 'react';
import { useSpeakCoach } from './useSpeakCoach';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { Mic, MicOff, Send, RefreshCw, History, MessageSquare, BookOpen } from 'lucide-react';

// ── Repeat tag parser ────────────────────────────────────────────────────────
function parseRepeat(text) {
  const match = text.match(/\[RÉP[EÈ]TE\s*:\s*"([^"]+)"\]/i)
             || text.match(/\[REPEAT\s*:\s*"([^"]+)"\]/i);
  if (!match) return { clean: text, repeatPhrase: null };
  return { clean: text.replace(match[0], '').trim(), repeatPhrase: match[1].trim() };
}

// ── IPA span highlighter (text between slashes like /ʁuʒ/) ──────────────────
function renderWithIpa(text) {
  const parts = [];
  const regex = /\/([^/\s]{1,12}\/)/g;
  let last = 0, match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    parts.push(
      <span key={match.index} style={{
        background: 'rgba(56,189,248,.15)', color: '#7dd3fc',
        border: '1px solid rgba(56,189,248,.25)', borderRadius: 5,
        padding: '1px 6px', fontFamily: 'monospace', fontSize: '.83em',
        fontWeight: 700, letterSpacing: '.5px',
      }}>/{match[1]}</span>
    );
    last = regex.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length > 1 ? parts : text;
}

export default function ChatbotAvatar() {
  const { lang }         = useLanguage();
  const { getCefrLevel } = useAuth();
  const [level] = useState(() => getCefrLevel() || 'B1');

  const [input,       setInput]       = useState('');
  const [activeTab,   setActiveTab]   = useState('chat');
  const [historyData, setHistoryData] = useState([]);
  const [isMobile,    setIsMobile]    = useState(() => window.innerWidth < 640);
  const chatEndRef = useRef(null);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const coach = useSpeakCoach({ lang, level, scenario: '' });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [coach.messages]);

  // Load localStorage history (conversations array) when History tab is opened
  const loadHistory = useCallback(() => {
    try {
      const key  = coach.historyKey();
      const data = JSON.parse(localStorage.getItem(key) || '[]');
      setHistoryData(data); // already newest-first
    } catch { setHistoryData([]); }
  }, [coach]);

  function handleTabChange(tab) {
    setActiveTab(tab);
    if (tab === 'history') loadHistory();
  }

  function handleSend() {
    if (!input.trim()) return;
    coach.sendText(input);
    setInput('');
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  const [openConvId, setOpenConvId] = useState(null);

  function clearHistory() {
    try { localStorage.removeItem(coach.historyKey()); } catch { /* ignore */ }
    setHistoryData([]);
    setOpenConvId(null);
  }

  function deleteConversation(id) {
    try {
      const key = coach.historyKey();
      const all = JSON.parse(localStorage.getItem(key) || '[]').filter(c => c.id !== id);
      localStorage.setItem(key, JSON.stringify(all));
      setHistoryData(all);
      if (openConvId === id) setOpenConvId(null);
    } catch { /* ignore */ }
  }

  const statusColors = {
    ready:     '#22c55e',
    loading:   '#a78bfa',
    recording: '#f87171',
    speaking:  '#38bdf8',
    error:     '#f87171',
  };
  const statusDot = statusColors[coach.status.type] || '#a78bfa';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      minHeight: isMobile ? 'calc(100dvh - 56px)' : 620,
      background: 'linear-gradient(160deg, #0d0a1a 0%, #0f0c1f 60%, #0a0d18 100%)',
      borderRadius: isMobile ? 0 : 24, overflow: 'hidden',
      boxShadow: isMobile ? 'none' : '0 32px 100px rgba(0,0,0,.75), 0 0 0 1px rgba(255,255,255,.06)',
      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", color: '#f0eaff',
    }}>

      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: isMobile ? '10px 14px' : '13px 20px',
        background: 'linear-gradient(90deg,rgba(149,128,212,.12),rgba(56,189,248,.08))',
        borderBottom: '1px solid rgba(255,255,255,.07)',
        flexShrink: 0, flexWrap: 'wrap', gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 12,
            background: 'linear-gradient(135deg, #9580d4 0%, #38bdf8 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, boxShadow: '0 3px 14px rgba(149,128,212,.5)',
          }}>🎙</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '.97rem', letterSpacing: '-.3px', lineHeight: 1.1 }}>SpeakCoach</div>
            <div style={{ fontSize: '.62rem', color: 'rgba(255,255,255,.4)', fontWeight: 600, letterSpacing: '.5px' }}>
              AI Pronunciation Coach
            </div>
          </div>
          <span style={{
            fontSize: '.6rem', background: 'linear-gradient(90deg,#38bdf8,#9580d4)',
            color: 'white', padding: '3px 10px', borderRadius: 20, fontWeight: 800, letterSpacing: '.5px',
          }}>AI COACH</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.09)',
            borderRadius: 20, padding: '5px 12px', fontSize: '.73rem', fontWeight: 700,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusDot, display: 'inline-block', boxShadow: `0 0 8px ${statusDot}` }} />
            {coach.status.text}
          </div>
          <div style={{
            background: 'rgba(149,128,212,.18)', border: '1px solid rgba(149,128,212,.28)',
            borderRadius: 20, padding: '5px 12px', fontSize: '.73rem', fontWeight: 800, color: '#c4b5fd',
          }}>
            {lang === 'fr' ? 'Niveau' : 'Level'} {level}
          </div>
        </div>
      </div>


      {/* ── Body ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── Avatar sidebar — hidden on mobile ── */}
        {!isMobile && <div style={{
          width: 234, flexShrink: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 14px 18px',
          background: 'linear-gradient(180deg,rgba(149,128,212,.14) 0%,rgba(56,189,248,.07) 60%,rgba(0,0,0,0) 100%)',
          borderRight: '1px solid rgba(255,255,255,.055)',
          position: 'relative', overflow: 'hidden',
        }}>

          {/* Background ambient orbs */}
          <div style={{
            position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
            width: 180, height: 180, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(149,128,212,.18) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)',
            width: 130, height: 130, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(56,189,248,.12) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          {/* Avatar glow ring + SVG */}
          <div style={{ position: 'relative', width: 188, zIndex: 1 }}>
            {/* Speaking pulse ring */}
            {coach.isSpeaking && (
              <div style={{
                position: 'absolute', inset: -22, borderRadius: '50%',
                background: 'radial-gradient(circle,rgba(56,189,248,.32) 0%,rgba(149,128,212,.14) 55%,transparent 75%)',
                animation: 'pulseGlow 1.7s ease-in-out infinite',
              }} />
            )}
            {/* Recording ring */}
            {coach.isRecording && (
              <div style={{
                position: 'absolute', inset: -18, borderRadius: '50%',
                background: 'radial-gradient(circle,rgba(248,113,113,.25) 0%,transparent 70%)',
                animation: 'pulseGlow 1s ease-in-out infinite',
              }} />
            )}
            <div ref={coach.svg.wrapper}>
              <AvatarSVG svg={coach.svg} />
            </div>
          </div>

          {/* Status label under avatar */}
          <div style={{
            fontSize: '.66rem', fontWeight: 700, color: statusDot,
            background: `${statusDot}18`, border: `1px solid ${statusDot}30`,
            borderRadius: 20, padding: '4px 12px', textAlign: 'center', zIndex: 1,
            letterSpacing: '.3px',
          }}>
            {coach.isSpeaking
              ? (lang === 'fr' ? '🔊 Le coach parle…' : '🔊 Coach speaking…')
              : coach.isRecording
                ? (lang === 'fr' ? '🎙 À l\'écoute…' : '🎙 Listening…')
                : (lang === 'fr' ? '💬 En attente' : '💬 Ready')}
          </div>

          {/* Sound bars */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 38, zIndex: 1 }}>
            {Array.from({ length: 9 }, (_, i) => (
              <div key={i} ref={el => (coach.svg.bars.current[i] = el)} style={{
                width: 4, height: 4, borderRadius: 3,
                background: coach.isRecording
                  ? 'linear-gradient(180deg,#f87171,#dc2626)'
                  : 'linear-gradient(180deg,#38bdf8,#9580d4)',
                transition: 'height .05s ease',
                animation: (coach.isRecording || coach.isSpeaking) ? 'none' : `barIdle 1.6s ease-in-out ${[0,.1,.2,.05,.15,.25,.3,.08,.18][i]}s infinite`,
              }} />
            ))}
          </div>

          {/* Mic button */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, zIndex: 1 }}>
            <button
              onClick={coach.toggleRecording}
              disabled={coach.micDisabled}
              style={{
                width: 62, height: 62, borderRadius: '50%', border: 'none',
                background: coach.isRecording
                  ? 'linear-gradient(135deg,#f87171,#dc2626)'
                  : 'linear-gradient(135deg,#9580d4,#6d5fbd)',
                color: 'white', cursor: coach.micDisabled ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: coach.isRecording
                  ? '0 0 0 0 rgba(248,113,113,.5), 0 6px 20px rgba(248,113,113,.5)'
                  : '0 6px 20px rgba(149,128,212,.5)',
                opacity: coach.micDisabled ? .38 : 1,
                animation: coach.isRecording ? 'micPulse 1s ease-in-out infinite' : 'none',
                transition: 'all .25s',
              }}
            >
              {coach.isRecording ? <MicOff size={24} /> : <Mic size={24} />}
            </button>
            <span style={{ fontSize: '.68rem', color: 'rgba(255,255,255,.4)', fontWeight: 600, textAlign: 'center' }}>
              {coach.isRecording
                ? (lang === 'fr' ? 'Cliquer pour arrêter' : 'Click to stop')
                : (lang === 'fr' ? 'Cliquer pour parler' : 'Click to speak')}
            </span>
          </div>
        </div>}

        {/* ── Chat + History panel ── */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', background: 'rgba(255,255,255,.015)' }}>

          {/* Mobile mic bar */}
          {isMobile && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14,
              padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,.07)',
              background: 'rgba(0,0,0,.2)', flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 24 }}>
                {Array.from({ length: 5 }, (_, i) => (
                  <div key={i} ref={el => (coach.svg.bars.current[i] = el)} style={{
                    width: 3, height: 4, borderRadius: 3,
                    background: coach.isRecording ? 'linear-gradient(180deg,#f87171,#dc2626)' : 'linear-gradient(180deg,#38bdf8,#9580d4)',
                    animation: (coach.isRecording || coach.isSpeaking) ? 'none' : `barIdle 1.6s ease-in-out ${[0,.1,.2,.05,.15][i]}s infinite`,
                  }} />
                ))}
              </div>
              <button
                onClick={coach.toggleRecording}
                disabled={coach.micDisabled}
                style={{
                  width: 52, height: 52, borderRadius: '50%', border: 'none',
                  background: coach.isRecording ? 'linear-gradient(135deg,#f87171,#dc2626)' : 'linear-gradient(135deg,#9580d4,#6d5fbd)',
                  color: 'white', cursor: coach.micDisabled ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: coach.isRecording ? '0 0 0 0 rgba(248,113,113,.5),0 4px 16px rgba(248,113,113,.5)' : '0 4px 16px rgba(149,128,212,.5)',
                  opacity: coach.micDisabled ? .38 : 1,
                  animation: coach.isRecording ? 'micPulse 1s ease-in-out infinite' : 'none',
                  transition: 'all .25s',
                }}
              >
                {coach.isRecording ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
              <span style={{ fontSize: '.7rem', color: statusDot, fontWeight: 700 }}>
                {coach.isRecording ? (lang === 'fr' ? 'À l\'écoute…' : 'Listening…') : coach.status.text}
              </span>
            </div>
          )}

          {/* Tab bar */}
          <div style={{
            display: 'flex', gap: 2, padding: '10px 14px 0',
            borderBottom: '1px solid rgba(255,255,255,.07)', background: 'rgba(0,0,0,.15)',
            flexShrink: 0,
          }}>
            {[
              { id: 'chat',    icon: MessageSquare, label: lang === 'fr' ? 'Conversation' : 'Conversation' },
              { id: 'history', icon: History,       label: lang === 'fr' ? 'Historique'   : 'History' },
              { id: 'tips',    icon: BookOpen,      label: lang === 'fr' ? 'Conseils IPA' : 'IPA Tips' },
            ].map(tab => (
              <button key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 14px', borderRadius: '10px 10px 0 0', border: 'none',
                  background: activeTab === tab.id ? 'rgba(149,128,212,.18)' : 'transparent',
                  borderBottom: activeTab === tab.id ? '2px solid #9580d4' : '2px solid transparent',
                  color: activeTab === tab.id ? '#c4b5fd' : 'rgba(255,255,255,.38)',
                  fontSize: '.75rem', fontWeight: 700, cursor: 'pointer', transition: 'all .2s',
                }}
              >
                <tab.icon size={14} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Chat tab ── */}
          {activeTab === 'chat' && (
            <>
              <div style={{
                flex: 1, overflowY: 'auto', padding: '18px 16px',
                display: 'flex', flexDirection: 'column', gap: 14,
                scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,.08) transparent',
              }}>
                {coach.messages.map(msg => (
                  <ChatMessage key={msg.id} message={msg} lang={lang} />
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* Input bar */}
              <div style={{
                borderTop: '1px solid rgba(255,255,255,.06)', padding: '11px 13px',
                display: 'flex', gap: 8, background: 'rgba(0,0,0,.2)', flexShrink: 0,
              }}>
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={lang === 'fr' ? 'Ou écrivez votre message…' : 'Or type your message…'}
                  rows={1}
                  disabled={coach.sendDisabled}
                  style={{
                    flex: 1, background: 'rgba(255,255,255,.055)', border: '1.5px solid rgba(255,255,255,.09)',
                    borderRadius: 12, color: '#f0eaff', padding: '10px 14px', fontSize: '.87rem',
                    outline: 'none', resize: 'none', fontFamily: 'inherit', fontWeight: 500,
                    height: 42, transition: 'border-color .2s', opacity: coach.sendDisabled ? .45 : 1,
                  }}
                  onFocus={e => e.target.style.borderColor = 'rgba(149,128,212,.55)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,.09)'}
                />
                <button
                  onClick={handleSend}
                  disabled={coach.sendDisabled || !input.trim()}
                  style={{
                    background: 'linear-gradient(135deg,#38bdf8,#0ea5e9)',
                    border: 'none', color: 'white', borderRadius: 12,
                    padding: '0 18px', cursor: (coach.sendDisabled || !input.trim()) ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                    fontWeight: 700, fontSize: '.84rem',
                    boxShadow: '0 3px 14px rgba(56,189,248,.3)',
                    opacity: (coach.sendDisabled || !input.trim()) ? .35 : 1,
                    transition: 'all .2s',
                  }}
                >
                  <Send size={15} />
                  {lang === 'fr' ? 'Envoyer' : 'Send'}
                </button>
              </div>
            </>
          )}

          {/* ── History tab ── */}
          {activeTab === 'history' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px',
              scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,.08) transparent' }}>

              {/* open conversation view */}
              {openConvId ? (() => {
                const conv = historyData.find(c => c.id === openConvId);
                if (!conv) return null;
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <button onClick={() => setOpenConvId(null)} style={{
                        background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)',
                        borderRadius: 8, color: 'rgba(255,255,255,.6)', fontSize: '.73rem', fontWeight: 700,
                        padding: '4px 10px', cursor: 'pointer',
                      }}>← {lang === 'fr' ? 'Retour' : 'Back'}</button>
                      <span style={{ fontSize: '.7rem', fontWeight: 700, color: 'rgba(255,255,255,.35)' }}>
                        {conv.date} {conv.startTime} · {conv.messages.length} {lang === 'fr' ? 'messages' : 'messages'}
                      </span>
                      <button onClick={() => deleteConversation(conv.id)} style={{
                        marginLeft: 'auto', background: 'rgba(248,113,113,.1)',
                        border: '1px solid rgba(248,113,113,.2)', borderRadius: 8,
                        color: '#f87171', fontSize: '.67rem', fontWeight: 700,
                        padding: '4px 10px', cursor: 'pointer',
                      }}>🗑</button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {conv.messages.map((m, i) => (
                        <HistoryMessage key={i} msg={m} lang={lang} />
                      ))}
                    </div>
                  </div>
                );
              })() : (
                <>
                  {historyData.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'rgba(255,255,255,.3)', fontSize: '.85rem', paddingTop: 40 }}>
                      <div style={{ fontSize: '2rem', marginBottom: 10 }}>💬</div>
                      <div style={{ fontWeight: 700 }}>
                        {lang === 'fr' ? 'Aucune conversation sauvegardée' : 'No saved conversations yet'}
                      </div>
                      <div style={{ fontSize: '.75rem', marginTop: 6, color: 'rgba(255,255,255,.2)' }}>
                        {lang === 'fr' ? 'Chaque session apparaît ici automatiquement' : 'Each session appears here automatically'}
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: '.68rem', fontWeight: 800, color: 'rgba(255,255,255,.3)',
                          textTransform: 'uppercase', letterSpacing: '.1em' }}>
                          {historyData.length} {lang === 'fr' ? 'conversations' : 'conversations'}
                        </span>
                        <button onClick={clearHistory} style={{
                          background: 'rgba(248,113,113,.1)', border: '1px solid rgba(248,113,113,.25)',
                          borderRadius: 8, color: '#f87171', fontSize: '.68rem', fontWeight: 700,
                          padding: '4px 10px', cursor: 'pointer',
                        }}>
                          🗑 {lang === 'fr' ? 'Tout effacer' : 'Clear all'}
                        </button>
                      </div>
                      {historyData.map((conv) => (
                        <button key={conv.id} onClick={() => setOpenConvId(conv.id)}
                          style={{
                            background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)',
                            borderRadius: 12, padding: '11px 14px', cursor: 'pointer', textAlign: 'left',
                            transition: 'background .15s', width: '100%',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(149,128,212,.12)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,.04)'}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: '.68rem', fontWeight: 800, color: '#c4b5fd' }}>
                              {conv.date} · {conv.startTime}
                            </span>
                            <span style={{ fontSize: '.62rem', color: 'rgba(255,255,255,.25)', fontWeight: 600 }}>
                              {conv.messages.length} msg
                            </span>
                          </div>
                          <p style={{
                            fontSize: '.82rem', color: 'rgba(255,255,255,.55)', margin: 0,
                            fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis',
                            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                          }}>
                            {conv.preview || (lang === 'fr' ? 'Conversation démarrée' : 'Session started')}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── IPA Tips tab ── */}
          {activeTab === 'tips' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '18px 16px',
              scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,.08) transparent' }}>
              <IpaTipsPanel lang={lang} />
            </div>
          )}
        </div>
      </div>

      <audio ref={coach.audioEl} preload="none" />

      <style>{`
        @keyframes pulseGlow  { 0%,100%{transform:scale(1);opacity:.5} 50%{transform:scale(1.07);opacity:1} }
        @keyframes micPulse   { 0%,100%{box-shadow:0 0 0 0 rgba(248,113,113,.5),0 6px 20px rgba(248,113,113,.5)} 50%{box-shadow:0 0 0 16px rgba(248,113,113,0),0 6px 20px rgba(248,113,113,.5)} }
        @keyframes barIdle    { 0%,100%{height:4px} 50%{height:16px} }
        @keyframes fadeIn     { from{opacity:0;transform:translateY(7px)} to{opacity:1;transform:none} }
        @keyframes repeatPulse{ 0%,100%{box-shadow:0 0 0 0 rgba(56,189,248,.4)} 50%{box-shadow:0 0 0 9px rgba(56,189,248,0)} }
        @keyframes pendingDot  { 0%,80%,100%{transform:scale(.6);opacity:.4} 40%{transform:scale(1.1);opacity:1} }
        @keyframes streamCursor{ 0%,100%{opacity:1} 50%{opacity:0} }
      `}</style>
    </div>
  );
}

// ── HistoryMessage — single message inside an open conversation ───────────────
function HistoryMessage({ msg, lang }) {
  const isUser = msg.role === 'user';
  const content = msg.text || msg.content || '';
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', maxWidth: '85%',
      alignSelf: isUser ? 'flex-end' : 'flex-start', animation: 'fadeIn .18s ease',
    }}>
      <div style={{ fontSize: '.62rem', fontWeight: 700, color: isUser ? '#c4b5fd' : '#7dd3fc',
        marginBottom: 3, letterSpacing: '.3px',
        alignSelf: isUser ? 'flex-end' : 'flex-start',
      }}>
        {isUser ? (lang === 'fr' ? 'Vous' : 'You') : 'Coach IA'}
        {msg.time && <span style={{ color: 'rgba(255,255,255,.22)', fontWeight: 400, marginLeft: 6 }}>{msg.time}</span>}
      </div>
      <div style={{
        padding: '9px 13px', borderRadius: 14, fontSize: '.84rem', lineHeight: 1.6,
        fontWeight: 500, wordBreak: 'break-word',
        ...(isUser ? {
          background: 'linear-gradient(135deg,rgba(149,128,212,.35),rgba(109,95,189,.3))',
          border: '1px solid rgba(149,128,212,.3)', borderBottomRightRadius: 4, color: '#ede8ff',
        } : {
          background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.09)',
          borderBottomLeftRadius: 4, color: '#e8e0ff',
        }),
      }}>
        {renderWithIpa(content)}
      </div>
    </div>
  );
}

// ── IpaTipsPanel ─────────────────────────────────────────────────────────────
function IpaTipsPanel({ lang }) {
  const tipsEN = [
    { symbol: '/θ/', example: 'think, three, bath', tip: 'Tongue tip between teeth, breathe out gently. No vibration.' },
    { symbol: '/ð/', example: 'the, this, weather', tip: 'Same as /θ/ but vibrate your vocal cords.' },
    { symbol: '/æ/', example: 'cat, hat, man, black', tip: 'Open mouth wide, tongue low and front. Like a short "a".' },
    { symbol: '/ɪ/', example: 'sit, big, fish, ring', tip: 'Short, relaxed "i". Tongue slightly raised, lips not stretched.' },
    { symbol: '/ɜː/', example: 'bird, word, heard', tip: 'Mid-central vowel. Lips neutral, tongue central. No "r" sound.' },
    { symbol: '/ŋ/', example: 'ring, sing, king', tip: 'Back of tongue touches soft palate. No "g" sound after.' },
    { symbol: '/r/', example: 'red, river, road', tip: 'Tongue tip curled back, never touching the roof. Lips slightly rounded.' },
    { symbol: '/v/', example: 'voice, five, love', tip: 'Upper teeth on lower lip, vibrate — unlike /f/ which is unvoiced.' },
  ];
  const tipsFR = [
    { symbol: '/ʁ/', example: 'rouge, renard, Paris', tip: 'Produit en arrière de la gorge, comme un gargarisme doux. Jamais avec la langue.' },
    { symbol: '/ɥ/', example: 'nuit, lui, bruit', tip: 'Lèvres arrondies (pour "ou") puis glissez vers "i". Semi-voyelle unique au français.' },
    { symbol: '/ɛ̃/', example: 'vin, main, pain', tip: 'Voyelle nasale : bouche mi-ouverte, le son passe par le nez. Pas de "n" final.' },
    { symbol: '/ɔ̃/', example: 'bon, pont, mouton', tip: 'Voyelle nasale : lèvres arrondies, son nasal. Pas de "n" final.' },
    { symbol: '/ɑ̃/', example: 'grand, temps, enfant', tip: 'Voyelle nasale ouverte : bouche ouverte, son passe par le nez.' },
    { symbol: '/ø/', example: 'deux, feu, bleu', tip: 'Lèvres arrondies (pour "o") mais langue en position de "é". Son mixte.' },
    { symbol: '/œ/', example: 'beurre, sœur, peur', tip: 'Comme /ø/ mais bouche plus ouverte. Lèvres arrondies, langue avancée.' },
    { symbol: '/ɲ/', example: 'montagne, gagner', tip: 'Langue contre le palais dur. Pas de "gn" prononcé séparément.' },
  ];

  const tips = lang === 'fr' ? tipsFR : tipsEN;
  return (
    <div>
      <div style={{ fontSize: '.68rem', fontWeight: 800, color: 'rgba(255,255,255,.3)',
        textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 14 }}>
        📚 {lang === 'fr' ? 'Sons difficiles du français' : 'Difficult English sounds'} — Guide IPA
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tips.map(tip => (
          <div key={tip.symbol} style={{
            display: 'flex', gap: 12, padding: '12px 14px', borderRadius: 12,
            background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)',
            animation: 'fadeIn .2s ease',
          }}>
            <div style={{
              minWidth: 46, height: 46, borderRadius: 10,
              background: 'linear-gradient(135deg,rgba(56,189,248,.2),rgba(149,128,212,.2))',
              border: '1px solid rgba(56,189,248,.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'monospace', fontSize: '1.05rem', fontWeight: 800, color: '#7dd3fc',
            }}>{tip.symbol}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '.8rem', fontWeight: 700, color: '#e8e0ff', marginBottom: 3 }}>
                {tip.example}
              </div>
              <div style={{ fontSize: '.75rem', color: 'rgba(255,255,255,.5)', lineHeight: 1.5 }}>
                {tip.tip}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── ChatMessage ───────────────────────────────────────────────────────────────
function ChatMessage({ message, lang }) {
  const { role, text, weakWords, time, pronScore, pronFeedback, pending } = message;
  const [copied, setCopied] = useState(false);

  // Pending bubble
  if (pending) {
    // Assistant streaming — show partial text with blinking cursor
    if (role === 'assistant' && text) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '82%', alignSelf: 'flex-start', animation: 'fadeIn .22s ease' }}>
          <div style={{
            padding: '11px 15px', borderRadius: 16, borderBottomLeftRadius: 4,
            background: 'rgba(255,255,255,.055)', border: '1px solid rgba(255,255,255,.09)',
            color: '#e8e0ff', fontSize: '.87rem', lineHeight: 1.65, fontWeight: 500, wordBreak: 'break-word',
          }}>
            {renderWithIpa(text)}
            <span style={{ display: 'inline-block', width: 2, height: '1em', background: '#a78bfa', marginLeft: 2, verticalAlign: 'text-bottom', animation: 'streamCursor .6s step-end infinite' }} />
          </div>
          <span style={{ fontSize: '.61rem', color: 'rgba(255,255,255,.25)', marginTop: 3, padding: '0 4px' }}>{time}</span>
        </div>
      );
    }

    // User transcribing — or empty assistant thinking dots
    const isUser = role === 'user';
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', maxWidth: '82%',
        alignSelf: isUser ? 'flex-end' : 'flex-start', animation: 'fadeIn .22s ease',
      }}>
        <div style={{
          padding: '11px 18px', borderRadius: 16,
          ...(isUser
            ? { borderBottomRightRadius: 4, background: 'linear-gradient(135deg,#9580d4,#6d5fbd)', boxShadow: '0 3px 14px rgba(149,128,212,.4)' }
            : { borderBottomLeftRadius: 4, background: 'rgba(255,255,255,.055)', border: '1px solid rgba(255,255,255,.09)' }
          ),
          color: 'white', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: '.82rem', fontWeight: 600, opacity: .75, color: isUser ? 'white' : '#c4b5fd' }}>
            {isUser
              ? (lang === 'fr' ? 'Transcription…' : 'Transcribing…')
              : (lang === 'fr' ? 'Le coach réfléchit…' : 'Coach thinking…')}
          </span>
          <span style={{ display: 'flex', gap: 3 }}>
            {[0, .18, .36].map(d => (
              <span key={d} style={{
                width: 5, height: 5, borderRadius: '50%',
                background: isUser ? 'rgba(255,255,255,.75)' : 'rgba(196,181,253,.7)',
                animation: `pendingDot .9s ${d}s ease-in-out infinite`,
                display: 'inline-block',
              }} />
            ))}
          </span>
        </div>
        <span style={{ fontSize: '.61rem', color: 'rgba(255,255,255,.25)', marginTop: 3, padding: '0 4px', alignSelf: isUser ? 'flex-end' : 'flex-start' }}>{time}</span>
      </div>
    );
  }

  const { clean, repeatPhrase } = role === 'assistant' ? parseRepeat(text) : { clean: text, repeatPhrase: null };

  const scoreColor = pronFeedback === 'excellent' ? '#22c55e'
                   : pronFeedback === 'good'      ? '#38bdf8'
                   : pronFeedback === 'fair'       ? '#f59e0b'
                   : '#f87171';

  function renderUserText() {
    if (!weakWords?.length) return clean;
    const regex = new RegExp(
      `\\b(${weakWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'gi'
    );
    const parts = []; let last = 0, match;
    while ((match = regex.exec(clean)) !== null) {
      if (match.index > last) parts.push(clean.slice(last, match.index));
      parts.push(
        <mark key={match.index} style={{
          background: 'rgba(251,191,36,.25)', color: '#fbbf24',
          borderRadius: 4, padding: '1px 4px', fontWeight: 700,
        }}>{match[0]}</mark>
      );
      last = regex.lastIndex;
    }
    if (last < clean.length) parts.push(clean.slice(last));
    return parts;
  }

  function handleCopy() {
    if (!repeatPhrase) return;
    navigator.clipboard.writeText(repeatPhrase).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', maxWidth: '82%',
      alignSelf: role === 'user' ? 'flex-end' : 'flex-start',
      animation: 'fadeIn .22s ease',
    }}>
      {role === 'user' && pronScore && (
        <span style={{
          fontSize: '.68rem', fontWeight: 800, padding: '3px 9px',
          borderRadius: 12, marginBottom: 4, alignSelf: 'flex-end',
          background: scoreColor, color: 'white', letterSpacing: '.5px',
          boxShadow: `0 2px 10px ${scoreColor}55`,
        }}>{pronScore}%</span>
      )}

      <div style={{
        padding: '11px 15px', borderRadius: 16, lineHeight: 1.65,
        fontSize: '.87rem', wordBreak: 'break-word', fontWeight: 500,
        ...(role === 'assistant' ? {
          background: 'rgba(255,255,255,.055)', border: '1px solid rgba(255,255,255,.09)',
          borderBottomLeftRadius: 4, color: '#e8e0ff',
        } : {
          background: 'linear-gradient(135deg,#9580d4,#6d5fbd)',
          color: 'white', borderBottomRightRadius: 4,
          boxShadow: '0 3px 14px rgba(149,128,212,.4)',
        }),
      }}>
        {role === 'user' ? renderUserText() : renderWithIpa(clean)}
      </div>

      {role === 'user' && weakWords?.length > 0 && (
        <div style={{
          fontSize: '.71rem', color: '#fbbf24',
          background: 'rgba(251,191,36,.07)', border: '1px solid rgba(251,191,36,.18)',
          borderRadius: 8, padding: '5px 10px', marginTop: 4,
          display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center', fontWeight: 600,
        }}>
          ⚠️ {lang === 'fr' ? 'Prononciation incertaine :' : 'Uncertain pronunciation:'}&nbsp;
          {weakWords.map((w, i) => (
            <span key={`${w}-${i}`} style={{
              background: 'rgba(251,191,36,.16)', color: '#fbbf24',
              borderRadius: 5, padding: '1px 7px', fontSize: '.67rem', fontWeight: 700,
            }}>{w}</span>
          ))}
        </div>
      )}

      {role === 'assistant' && repeatPhrase && (
        <div style={{
          marginTop: 8, borderRadius: 12, overflow: 'hidden',
          border: '1.5px solid rgba(56,189,248,.3)',
          background: 'linear-gradient(135deg,rgba(56,189,248,.07),rgba(149,128,212,.05))',
          animation: 'repeatPulse 2s ease-in-out 1',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderBottom: '1px solid rgba(56,189,248,.18)',
            background: 'rgba(56,189,248,.09)',
          }}>
            <RefreshCw size={11} style={{ color: '#38bdf8' }} />
            <span style={{ fontSize: '.63rem', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '.8px' }}>
              {lang === 'fr' ? 'Répète cette phrase' : 'Repeat this phrase'}
            </span>
          </div>
          <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: '.87rem', fontWeight: 700, color: '#e0f2fe', lineHeight: 1.5, flex: 1 }}>
              🗣 «&nbsp;{repeatPhrase}&nbsp;»
            </span>
            <button onClick={handleCopy} style={{
              background: copied ? 'rgba(34,197,94,.18)' : 'rgba(56,189,248,.12)',
              border: `1px solid ${copied ? 'rgba(34,197,94,.38)' : 'rgba(56,189,248,.28)'}`,
              borderRadius: 8, padding: '5px 10px', cursor: 'pointer',
              color: copied ? '#86efac' : '#7dd3fc', fontSize: '.67rem', fontWeight: 700,
              transition: 'all .2s', whiteSpace: 'nowrap',
            }}>
              {copied ? `✓ ${lang === 'fr' ? 'Copié' : 'Copied'}` : `📋 ${lang === 'fr' ? 'Copier' : 'Copy'}`}
            </button>
          </div>
        </div>
      )}

      <span style={{
        fontSize: '.61rem', color: 'rgba(255,255,255,.25)', marginTop: 3,
        padding: '0 4px', fontWeight: 500,
        alignSelf: role === 'user' ? 'flex-end' : 'flex-start',
      }}>{time}</span>
    </div>
  );
}

// ── AvatarSVG ─────────────────────────────────────────────────────────────────
function AvatarSVG({ svg }) {
  return (
    <svg viewBox="0 0 200 230" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: 'auto', display: 'block' }}>
      <defs>
        <radialGradient id="sc-skinGrad" cx="45%" cy="38%" r="60%">
          <stop offset="0%"   stopColor="#FFF0E6" />
          <stop offset="100%" stopColor="#E2C1B3" />
        </radialGradient>
        <linearGradient id="sc-hairGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor="#1A1A1A" />
          <stop offset="100%" stopColor="#0a0a0a" />
        </linearGradient>
        <linearGradient id="sc-shirtGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#1E3A5F" />
          <stop offset="100%" stopColor="#0F1D2F" />
        </linearGradient>
        <linearGradient id="sc-collarGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor="#ffffff" />
          <stop offset="100%" stopColor="#d0d0d0" />
        </linearGradient>
        <filter id="sc-headShadow">
          <feDropShadow dx="0" dy="6" stdDeviation="9" floodColor="rgba(0,0,0,.25)" />
        </filter>
        <filter id="sc-hairShadow">
          <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="rgba(0,0,0,.4)" />
        </filter>
      </defs>

      {/* Back Hair */}
      <path d="M 35,100 Q 25,170 30,220 L 170,220 Q 175,170 165,100 Z" fill="url(#sc-hairGrad)" />

      {/* Body/Shirt */}
      <path ref={svg.chest} d="M30,230 Q40,175 70,178 L100,192 L130,178 Q160,175 170,230Z" fill="url(#sc-shirtGrad)" />
      {/* Shirt collar */}
      <path d="M85,185 L100,200 L115,185 L110,178 L100,192 L90,178 Z" fill="url(#sc-collarGrad)" opacity=".9" />
      {/* Tie */}
      <path d="M97,192 L100,218 L103,192 L100,186 Z" fill="#9580d4" opacity=".8" />

      {/* Head Group */}
      <g ref={svg.head} style={{ transformOrigin: '100px 185px', transition: 'transform 0.1s ease-out' }}>

        {/* Neck */}
        <rect x="85" y="150" width="30" height="40" rx="12" fill="#E2C1B3" />
        <path d="M85,170 Q100,185 115,170 L115,190 L85,190 Z" fill="#D1A796" />

        {/* Face */}
        <ellipse cx="100" cy="105" rx="55" ry="70" fill="url(#sc-skinGrad)" filter="url(#sc-headShadow)" />

        {/* Front Hair / Bangs */}
        <path d="M45,105 Q45,25 100,25 Q155,25 155,105 Q155,115 148,115 Q140,55 100,55 Q60,55 52,115 Q45,115 45,105 Z" fill="url(#sc-hairGrad)" filter="url(#sc-hairShadow)" />
        <path d="M100,25 Q60,25 45,95 Q55,40 100,25Z" fill="#2a2a2a" opacity="0.3" />

        {/* Ears */}
        <ellipse cx="45"  cy="115" rx="6"   ry="11" fill="#E2C1B3" />
        <ellipse cx="155" cy="115" rx="6"   ry="11" fill="#E2C1B3" />
        <ellipse cx="45"  cy="115" rx="2.5" ry="5"  fill="#D1A796" opacity=".6" />
        <ellipse cx="155" cy="115" rx="2.5" ry="5"  fill="#D1A796" opacity=".6" />

        {/* Eyebrows */}
        <path ref={svg.eyebrowL} d="M70,88 Q78,84 88,86" fill="none" stroke="#1A1A1A" strokeWidth="3" strokeLinecap="round" />
        <path ref={svg.eyebrowR} d="M112,86 Q122,84 130,88" fill="none" stroke="#1A1A1A" strokeWidth="3" strokeLinecap="round" />

        {/* Eye whites */}
        <ellipse cx="78"  cy="104" rx="10" ry="7" fill="white" />
        <ellipse cx="122" cy="104" rx="10" ry="7" fill="white" />

        {/* Pupils */}
        <g ref={svg.pupilL}>
          <ellipse cx="78" cy="104" rx="5.5" ry="6"  fill="#2C1A0E" />
          <circle  cx="78" cy="104" r="3"            fill="#000000" />
          <circle  cx="80" cy="101.5" r="1.5"        fill="white"   opacity=".9" />
          <circle  cx="76" cy="106"   r="0.8"        fill="white"   opacity=".6" />
        </g>
        <g ref={svg.pupilR}>
          <ellipse cx="122" cy="104" rx="5.5" ry="6" fill="#2C1A0E" />
          <circle  cx="122" cy="104" r="3"           fill="#000000" />
          <circle  cx="124" cy="101.5" r="1.5"       fill="white"   opacity=".9" />
          <circle  cx="120" cy="106"   r="0.8"       fill="white"   opacity=".6" />
        </g>

        {/* Eyelashes */}
        <path d="M68,103 Q76,96 86,103"  fill="none" stroke="#1A1A1A" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M66,101 L62,96"         fill="none" stroke="#1A1A1A" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M114,103 Q124,96 132,103" fill="none" stroke="#1A1A1A" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M134,101 L138,96"       fill="none" stroke="#1A1A1A" strokeWidth="1.5" strokeLinecap="round" />

        {/* Eyelids (for blinking) */}
        <ellipse ref={svg.eyelidL} cx="78"  cy="97" rx="12" ry="0" fill="#E2C1B3" />
        <ellipse ref={svg.eyelidR} cx="122" cy="97" rx="12" ry="0" fill="#E2C1B3" />

        {/* Nose */}
        <path d="M100,115 L98,130 Q100,133 103,130 L100,128" fill="none" stroke="#D1A796" strokeWidth="2" strokeLinecap="round" />

        {/* Cheek blush */}
        <ellipse cx="65"  cy="124" rx="10" ry="5" fill="#F43F5E" opacity=".14" />
        <ellipse cx="135" cy="124" rx="10" ry="5" fill="#F43F5E" opacity=".14" />

        {/* Mouth */}
        <path ref={svg.mouthBase} d="M85,153 Q100,153 115,153 Q100,153 85,153 Z" fill="#5E1825" />
        <path ref={svg.teeth}     d="M88,153 Q100,153 112,153 L106,155 L94,155 Z" fill="white" opacity="0" />
        <path ref={svg.upperLip}  d="M85,153 Q93,149 100,151 Q107,149 115,153 Q100,153 85,153"  fill="#D35F6D" />
        <path ref={svg.lowerLip}  d="M85,153 Q100,153 115,153 Q100,157 85,153"                  fill="#E17B88" />
      </g>
    </svg>
  );
}
