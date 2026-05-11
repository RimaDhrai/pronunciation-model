/**
 * useSpeakCoach.js
 *
 * BUG FIXÉ : sessionId capturé via useRef (pas via closure state)
 *   → startRecording/onRecordingStop avaient un sessionId=null stale
 *   → Spring Boot recevait session_id null → FastAPI 404 → Spring Boot 500
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../api/axios';
import { getStoredToken } from '../../api/keycloakAuth';

const BASE = '/api/chat';

function pcmToWav(pcm, sr) {
  const samples = new Int16Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) {
    samples[i] = Math.max(-32768, Math.min(32767, Math.round(pcm[i] * 32767)));
  }
  const dataLen = samples.length * 2;
  const buf = new ArrayBuffer(44 + dataLen);
  const v   = new DataView(buf);
  const w   = (off, s) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + dataLen, true);
  w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, dataLen, true);
  new Int16Array(buf, 44).set(samples);
  return new Blob([buf], { type: 'audio/wav' });
}

export function useSpeakCoach({ lang, level, scenario = '' }) {
  // ── State (pour le rendu) ─────────────────────────────────────────────────
  const [sessionId,   setSessionId]   = useState(null);
  const [messages,    setMessages]    = useState([]);
  const [status,      setStatus]      = useState({ text: 'Connexion…', type: 'loading' });
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking,  setIsSpeaking]  = useState(false);
  const [micDisabled, setMicDisabled] = useState(true);
  const [sendDisabled,setSendDisabled]= useState(true);

  // ── Refs stables pour les closures (évite le problème de capture stale) ───
  const sessionIdRef = useRef(null);
  const langRef      = useRef(lang);   // toujours la langue courante dans les closures
  const speakingRef  = useRef(false);
  const recordingRef = useRef(false);

  useEffect(() => { langRef.current = lang; }, [lang]);

  // ── Audio ─────────────────────────────────────────────────────────────────
  const audioEl          = useRef(null);
  const audioCtx         = useRef(null);
  const playAnalyser     = useRef(null);
  const micAnalyser      = useRef(null);
  const playSourceLinked = useRef(false);

  // ── Recorder ─────────────────────────────────────────────────────────────
  const recorderRef   = useRef(null);
  const chunksRef     = useRef([]);
  const streamRef     = useRef(null);
  const processingRef = useRef(false); // guard: MediaRecorder.onstop fires twice on some browsers
  const pcmChunksRef  = useRef([]);    // raw PCM captured via ScriptProcessor (primary WAV source)
  const scriptNodeRef = useRef(null);

  // ── Animation ─────────────────────────────────────────────────────────────
  const rafRef    = useRef(null);
  const animating = useRef(false);

  // ── SVG avatar refs ────────────────────────────────────────────────────────
  const svg = {
    mouthBase:  useRef(null),
    upperLip:   useRef(null),
    teeth:      useRef(null),
    lowerLip:   useRef(null),
    eyelidL:    useRef(null),
    eyelidR:    useRef(null),
    pupilL:     useRef(null),
    pupilR:     useRef(null),
    eyebrowL:   useRef(null),
    eyebrowR:   useRef(null),
    head:       useRef(null),
    chest:      useRef(null),
    bars:       useRef([]),
    wrapper:    useRef(null),
  };

  // ── Session ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const ctrl = new AbortController();
    setMessages([]);
    startSession(ctrl.signal);
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, level, scenario]);

  // ── i18n helper (uses langRef for closure-safe access) ──────────────────────
  const s = (fr, en) => langRef.current === 'en' ? en : fr;

  // ── SSE fetch helper — reads token events line by line ───────────────────
  async function* fetchSse(path, formData) {
    const headers = {};
    const token = getStoredToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(path, { method: 'POST', body: formData, headers });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const reader  = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let currentEvent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete last line

      for (const line of lines) {
        if (line.startsWith('event:')) {
          currentEvent = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          try {
            const data = JSON.parse(line.slice(5).trim());
            yield { event: currentEvent, data };
          } catch { /* non-JSON line */ }
          currentEvent = '';
        }
      }
    }
  }

  // ── localStorage history helpers — per-conversation sessions ──────────────
  const currentConvIdRef = useRef(null);

  function historyKey() { return `sc_chat_history_${langRef.current}`; }

  function _startConversation(greeting) {
    const id = crypto.randomUUID();
    currentConvIdRef.current = id;
    try {
      const key   = historyKey();
      const all   = JSON.parse(localStorage.getItem(key) || '[]');
      const conv  = {
        id,
        date:      new Date().toLocaleDateString(langRef.current === 'fr' ? 'fr-FR' : 'en-GB'),
        startTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        preview:   (greeting || '').slice(0, 70),
        messages:  greeting ? [{ role: 'assistant', text: greeting, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }] : [],
      };
      all.unshift(conv);                  // newest first
      if (all.length > 50) all.length = 50; // keep last 50 conversations
      localStorage.setItem(key, JSON.stringify(all));
    } catch { /* ignore quota */ }
  }

  function saveToLog(role, text) {
    if (!currentConvIdRef.current || !text?.trim()) return;
    try {
      const key  = historyKey();
      const all  = JSON.parse(localStorage.getItem(key) || '[]');
      const conv = all.find(c => c.id === currentConvIdRef.current);
      if (!conv) return;
      conv.messages.push({
        role, text,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
      // Update preview with last user message if not set
      if (role === 'user' && !conv.preview) conv.preview = text.slice(0, 70);
      if (conv.messages.length > 200) conv.messages.splice(0, conv.messages.length - 200);
      localStorage.setItem(key, JSON.stringify(all));
    } catch { /* ignore quota */ }
  }

  async function startSession(signal) {
    sessionIdRef.current = null;
    setSessionId(null);
    setMicDisabled(true);
    setSendDisabled(true);
    setStatus({ text: s('Connexion…', 'Connecting…'), type: 'loading' });

    const fd = new FormData();
    fd.append('lang',     lang);
    fd.append('level',    level);
    fd.append('scenario', scenario);
    const masterSid = localStorage.getItem('masterSessionId');
    if (masterSid) fd.append('master_session_id', masterSid);

    try {
      const { data } = await api.post(`${BASE}/session/start`, fd, { signal });
      if (signal?.aborted) return;

      sessionIdRef.current = data.session_id;
      setSessionId(data.session_id);

      pushMessage('assistant', data.greeting, []);
      _startConversation(data.greeting); // opens a new conversation entry in history

      if (data.audio_base64) {
        setStatus({ text: s('Le coach parle…', 'The coach is speaking…'), type: 'speaking' });
        await playAudio(data.audio_base64);
      }
      setReady();
    } catch (err) {
      if (signal?.aborted || err?.code === 'ERR_CANCELED') return;
      console.error('[SpeakCoach] startSession:', err);
      setStatus({ text: s('Erreur connexion — vérifiez les serveurs', 'Connection error — check your servers'), type: 'error' });
    }
  }

  function setReady() {
    setStatus({ text: s('Appuyez sur le micro pour parler', 'Click mic to speak'), type: 'ready' });
    setMicDisabled(false);
    setSendDisabled(false);
  }

  // ── Recording ──────────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    if (speakingRef.current || recordingRef.current) return;
    if (!sessionIdRef.current) return;   // sécurité : pas de session active

    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: true,
          sampleRate: 16000,
        }
      });
    } catch {
      setStatus({ text: s('Accès micro refusé', 'Microphone access denied'), type: 'error' });
      return;
    }

    // Création AudioContext après geste utilisateur (obligatoire dans Chrome)
    _ensureAudioContext();
    if (audioCtx.current?.state === 'suspended') await audioCtx.current.resume();

    const micSrc = audioCtx.current.createMediaStreamSource(streamRef.current);
    micAnalyser.current = audioCtx.current.createAnalyser();
    micAnalyser.current.fftSize = 256;
    micSrc.connect(micAnalyser.current);

    // Boost x3 via GainNode → ScriptProcessor (PCM capture) → muted output
    // Avoids createMediaStreamDestination which produces silent audio in Chrome
    const gainNode = audioCtx.current.createGain();
    gainNode.gain.value = 3.0;
    micSrc.connect(gainNode);

    pcmChunksRef.current = [];
    const scriptNode = audioCtx.current.createScriptProcessor(2048, 1, 1);
    scriptNodeRef.current = scriptNode;
    // eslint-disable-next-line deprecation/deprecation
    scriptNode.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0);
      pcmChunksRef.current.push(new Float32Array(input));
    };
    gainNode.connect(scriptNode);
    const muteGain = audioCtx.current.createGain();
    muteGain.gain.value = 0; // silent — no speaker echo
    scriptNode.connect(muteGain);
    muteGain.connect(audioCtx.current.destination);

    // MediaRecorder on raw stream — only used for onstop timing signal
    chunksRef.current = [];
    const recorder = new MediaRecorder(streamRef.current, { mimeType: 'audio/webm;codecs=opus' });
    recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = onRecordingStop;
    recorder.start();
    recorderRef.current = recorder;

    recordingRef.current = true;
    setIsRecording(true);
    setStatus({ text: s('Enregistrement…', 'Recording…'), type: 'recording' });
    startAnimation();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const stopRecording = useCallback(() => {
    if (!recordingRef.current) return;
    // Freeze PCM capture FIRST so all chunks are available when onstop fires
    if (scriptNodeRef.current) {
      scriptNodeRef.current.onaudioprocess = null;
      try { scriptNodeRef.current.disconnect(); } catch { /* ignore */ }
      scriptNodeRef.current = null;
    }
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    micAnalyser.current = null;
    recordingRef.current = false;
    setIsRecording(false);
    setMicDisabled(true);
    setStatus({ text: s('Analyse en cours…', 'Analysing…'), type: 'loading' });
    stopAnimation();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── FIX : utilise sessionIdRef.current (pas la state sessionId) ──────────
  async function onRecordingStop() {
    // Clear onstop FIRST — Chrome fires it twice when stream tracks end after recorder.stop()
    if (recorderRef.current) recorderRef.current.onstop = null;
    if (processingRef.current) return;
    processingRef.current = true;

    const currentSessionId = sessionIdRef.current;
    if (!currentSessionId) {
      setStatus({ text: s('Session expirée — rechargez la page', 'Session expired — reload the page'), type: 'error' });
      setMicDisabled(false);
      processingRef.current = false;
      return;
    }

    // User pending bubble
    const pendingId   = crypto.randomUUID();
    const thinkingId  = crypto.randomUUID();
    pushMessage('user', '…', [], { id: pendingId, pending: true });

    // Build WAV from captured PCM (primary) or fallback to raw MediaRecorder webm
    let blob;
    const pcmChunks = pcmChunksRef.current;
    if (pcmChunks.length > 0 && audioCtx.current) {
      const sr     = audioCtx.current.sampleRate;
      const total  = pcmChunks.reduce((s, c) => s + c.length, 0);
      const allPcm = new Float32Array(total);
      let off = 0;
      for (const chunk of pcmChunks) { allPcm.set(chunk, off); off += chunk.length; }
      blob = pcmToWav(allPcm, sr);
    } else {
      blob = new Blob(chunksRef.current, { type: 'audio/webm' });
    }
    const fd = new FormData();
    fd.append('session_id',  currentSessionId);
    fd.append('audio',       blob, blob.type === 'audio/wav' ? 'recording.wav' : 'recording.webm');
    fd.append('native_lang', langRef.current);
    const masterSidVoice = localStorage.getItem('masterSessionId');
    if (masterSidVoice) fd.append('master_session_id', masterSidVoice);

    let completedNormally = false;
    try {
      let accumulated = '';
      let thinkingShown = false;

      for await (const { event, data } of fetchSse(`${BASE}/voice-sse`, fd)) {
        if (event === 'transcript') {
          if (data.text) {
            updateMessage(pendingId, {
              text:         data.text,
              pending:      false,           // ← fix: bubble was stuck as "Transcribing…"
              weakWords:    data.weak_words ?? [],
              pronScore:    data.pron_score ?? null,
              pronFeedback: data.pron_feedback ?? null,
            });
            saveToLog('user', data.text);
          } else {
            setMessages(prev => prev.filter(m => m.id !== pendingId));
          }
          // Show Alex thinking bubble once transcript is known
          if (!thinkingShown) {
            thinkingShown = true;
            setMessages(prev => [...prev, {
              id: thinkingId, role: 'assistant', text: '…', weakWords: [],
              pending: true, pronScore: null, pronFeedback: null,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }]);
          }
          // Re-enable mic immediately — user can speak while Alex is streaming
          setMicDisabled(false);
          setSendDisabled(false);
          setStatus({ text: s('Le coach réfléchit…', 'The coach is thinking…'), type: 'loading' });

        } else if (event === 'token') {
          if (!thinkingShown) {
            thinkingShown = true;
            setMessages(prev => [...prev, {
              id: thinkingId, role: 'assistant', text: '', weakWords: [],
              pending: true, pronScore: null, pronFeedback: null,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }]);
          }
          accumulated += data.text ?? '';
          updateMessage(thinkingId, { text: accumulated, pending: true });

        } else if (event === 'complete') {
          completedNormally = true;
          const response = data.response ?? accumulated;
          updateMessage(thinkingId, { text: response, pending: false });
          saveToLog('assistant', response);
          if (data.audio_base64) {
            // Block mic only during audio playback (avoid feedback)
            setMicDisabled(true);
            setStatus({ text: s('Le coach répond…', 'The coach is speaking…'), type: 'speaking' });
            await playAudio(data.audio_base64);
          }
          setReady();
          break; // stream closed — exit immediately

        } else if (event === 'error') {
          setMessages(prev => prev.filter(m => m.id !== pendingId && m.id !== thinkingId));
          const msg = data.error === 'SILENT_AUDIO'
            ? s('Audio non détecté — parlez plus fort', 'No audio detected — speak louder')
            : data.error === 'TIMEOUT'
            ? s('Délai dépassé — réessayez', 'Response timed out — try again')
            : s('Erreur serveur — réessayez', 'Server error — try again');
          setStatus({ text: msg, type: 'error' });
          setTimeout(setReady, 2500);
          setMicDisabled(false);
          return;
        }
      }
    } catch (err) {
      console.error('[SpeakCoach] voice-sse:', err);
      setMessages(prev => prev.filter(m => m.id !== pendingId && m.id !== thinkingId));
      if (err.message?.includes('404') || err.status === 404) {
        setStatus({ text: s('Session expirée — reconnexion…', 'Session expired — reconnecting…'), type: 'loading' });
        setMicDisabled(true);
        await startSession(new AbortController().signal);
        return;
      }
      setStatus({ text: s('Erreur serveur — réessayez', 'Server error — try again'), type: 'error' });
      setTimeout(setReady, 3000);
      setMicDisabled(false);
    } finally {
      // Safety net: if stream ended without 'complete' (server error, timeout, bad JSON…)
      // make sure UI is never permanently stuck
      if (!completedNormally) {
        setMicDisabled(false);
        setSendDisabled(false);
      }
      processingRef.current = false; // reset guard for next recording
    }
  }

  // ── Initialise l'AudioContext après un geste utilisateur ─────────────────
  // Appelé depuis startRecording (clic mic) → AudioContext autorisé par Chrome
  function _ensureAudioContext() {
    if (audioCtx.current) return;
    try {
      audioCtx.current = new AudioContext();
    } catch { /* ignore */ }
  }

  function _linkPlayAnalyser() {
    if (playSourceLinked.current || !audioCtx.current || !audioEl.current) return;
    try {
      const src = audioCtx.current.createMediaElementSource(audioEl.current);
      playAnalyser.current = audioCtx.current.createAnalyser();
      playAnalyser.current.fftSize = 512;
      src.connect(playAnalyser.current);
      playAnalyser.current.connect(audioCtx.current.destination);
      playSourceLinked.current = true;
    } catch { /* already linked or unavailable */ }
  }

  // ── Audio playback + lip sync ──────────────────────────────────────────────
  async function playAudio(base64) {
    if (!base64 || !audioEl.current) return;

    // Decode base64 → Blob → keep in memory until playback ends (no premature revoke)
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const blob  = new Blob([bytes], { type: 'audio/mpeg' });
    const url   = URL.createObjectURL(blob);

    // Cleanup helper — called exactly once via resolved flag
    let cleaned = false;
    function cleanup() {
      if (cleaned) return;
      cleaned = true;
      URL.revokeObjectURL(url);
      speakingRef.current = false;
      setIsSpeaking(false);
      svg.wrapper.current?.classList.remove('speaking');
      stopAnimation();
      resetMouth();
    }

    // Set src BEFORE play() — browser needs time to map the blob URL
    audioEl.current.src = url;
    audioEl.current.load();   // explicit load so browser registers the blob URL

    // Resume AudioContext only if already created by a user gesture (mic click)
    // Never create it here — Chrome blocks AudioContext without prior user gesture
    if (audioCtx.current) {
      try {
        if (audioCtx.current.state === 'suspended') await audioCtx.current.resume();
        _linkPlayAnalyser();
      } catch { /* audio plays without lip-sync */ }
    }
    const audioContextReady = audioCtx.current?.state === 'running';

    speakingRef.current = true;
    setIsSpeaking(true);
    setMicDisabled(true);
    svg.wrapper.current?.classList.add('speaking');
    if (audioContextReady) startAnimation();

    // Wait for the audio element to be ready before calling play()
    await new Promise(resolve => {
      if (audioEl.current.readyState >= 2) { resolve(); return; }
      audioEl.current.oncanplay = resolve;
      // If canplay never fires within 5s, proceed anyway
      setTimeout(resolve, 5_000);
    });
    audioEl.current.oncanplay = null;

    let played = false;
    try {
      await audioEl.current.play();
      played = true;
    } catch {
      // Autoplay blocked by browser policy
    }

    if (!played) {
      cleanup();
      return;
    }

    // Wait for playback to finish naturally
    await new Promise(resolve => {
      const done = () => { cleanup(); resolve(); };

      audioEl.current.onended  = done;
      audioEl.current.onerror  = done;   // error during playback → unblock

      // Safety timeout (audio duration * 2 + 5s, min 30s)
      const duration = audioEl.current.duration || 0;
      const timeout  = Math.max(30_000, (duration * 2 + 5) * 1_000);
      const tid = setTimeout(done, timeout);

      // Clear timeout if done fires first
      const origDone = done;
      audioEl.current.onended = () => { clearTimeout(tid); origDone(); };
      audioEl.current.onerror = () => { clearTimeout(tid); origDone(); };
    });
  }

  // ── Animation ─────────────────────────────────────────────────────────────
  function startAnimation() {
    if (animating.current) return;
    animating.current = true;
    animate();
  }
  function stopAnimation() {
    animating.current = false;
    cancelAnimationFrame(rafRef.current);
    resetBars();
  }
  
  function animate(time) {
    if (!animating.current) return;
    
    // ── Base animations (Breathing & Looking) ──
    const slowTime = time / 2000; // breathing cycle
    const breath   = Math.sin(slowTime) * 0.02 + 1; // 1.0 to 1.04
    if (svg.chest.current) svg.chest.current.style.transform = `scale(${breath})`;
    if (svg.chest.current) svg.chest.current.style.transformOrigin = 'center 200px';

    // ── Random Look Around ──
    const lookX = Math.sin(time / 1500) * 1.5;
    const lookY = Math.cos(time / 1800) * 1.0;
    if (svg.pupilL.current) svg.pupilL.current.style.transform = `translate(${lookX}px, ${lookY}px)`;
    if (svg.pupilR.current) svg.pupilR.current.style.transform = `translate(${lookX}px, ${lookY}px)`;

    // ── Head Sway ──
    const sway = Math.sin(time / 2500) * 1.2;
    if (svg.head.current) svg.head.current.style.transform = `rotate(${sway}deg)`;

    // ── Audio-driven animations ──
    const analyser = speakingRef.current ? playAnalyser.current : micAnalyser.current;
    if (analyser) {
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);
      
      // Bars animation
      svg.bars.current.forEach((bar, i) => {
        if (!bar) return;
        bar.style.height = Math.max(4, (data[Math.floor(i * data.length / svg.bars.current.length)] / 255) * 60) + 'px';
      });

      const slice = data.slice(8, 80);
      const avg   = slice.reduce((a, b) => a + b, 0) / slice.length;
      const volumeRatio = Math.min(avg / 65, 1);

      if (speakingRef.current) {
        setMouth(volumeRatio);
        
        // Eyebrows movement while talking
        const browLift = volumeRatio * -4;
        if (svg.eyebrowL.current) svg.eyebrowL.current.style.transform = `translateY(${browLift}px)`;
        if (svg.eyebrowR.current) svg.eyebrowR.current.style.transform = `translateY(${browLift}px)`;
        
        // Slightly more head movement when talking
        const nod = Math.sin(time / 200) * volumeRatio * 2;
        if (svg.head.current) svg.head.current.style.transform = `rotate(${sway}deg) translateY(${nod}px)`;
      } else {
        // Reset eyebrows if not talking (or slightly react to mic)
        if (svg.eyebrowL.current) svg.eyebrowL.current.style.transform = 'translateY(0)';
        if (svg.eyebrowR.current) svg.eyebrowR.current.style.transform = 'translateY(0)';
      }
    }
    
    rafRef.current = requestAnimationFrame(animate);
  }

  // ── Avatar ─────────────────────────────────────────────────────────────────
  function setMouth(o) {
    const open = Math.max(0, o);
    const h = open * 14; 
    
    if (svg.mouthBase.current) {
        svg.mouthBase.current.setAttribute('d', `M85,153 Q100,${153-h/2} 115,153 Q100,${153+h} 85,153 Z`);
    }
    if (svg.upperLip.current) {
        svg.upperLip.current.setAttribute('d', `M85,153 Q93,${149-h/3} 100,${151-h/3} Q107,${149-h/3} 115,153 Q100,${153-h/2} 85,153`);
    }
    if (svg.lowerLip.current) {
        svg.lowerLip.current.setAttribute('d', `M85,153 Q100,${153+h/2} 115,153 Q100,${157+h} 85,153`);
    }
    if (svg.teeth.current) {
        svg.teeth.current.style.opacity = open > 0.15 ? Math.min(open * 2, 1) : 0;
        svg.teeth.current.setAttribute('d', `M88,${153-h/4} Q100,${153-h/4} 112,${153-h/4} L108,${153+h/4} L92,${153+h/4} Z`);
    }
  }
  function resetMouth() { setMouth(0); }
  function resetBars()  { svg.bars.current.forEach(b => { if (b) b.style.height = '4px'; }); }

  // ── Blinking ───────────────────────────────────────────────────────────────
  useEffect(() => {
    let timeout;
    function blink() {
      svg.eyelidL.current?.setAttribute('ry', 15);
      svg.eyelidR.current?.setAttribute('ry', 15);
      setTimeout(() => {
        svg.eyelidL.current?.setAttribute('ry', 0);
        svg.eyelidR.current?.setAttribute('ry', 0);
        timeout = setTimeout(blink, 3200 + Math.random() * 3500);
      }, 115);
    }
    timeout = setTimeout(blink, 2000 + Math.random() * 2000);
    return () => clearTimeout(timeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Messages ───────────────────────────────────────────────────────────────
  function pushMessage(role, text, weakWords = [], extra = {}) {
    if (!text?.trim()) return;
    const id = extra.id ?? crypto.randomUUID();
    setMessages(prev => [...prev, {
      id, role, text, weakWords,
      pending:      extra.pending      ?? false,
      pronScore:    extra.pronScore    ?? null,
      pronFeedback: extra.pronFeedback ?? null,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }]);
    return id;
  }

  function updateMessage(id, patch) {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m));
  }

  // ── Send text ──────────────────────────────────────────────────────────────
  const sendText = useCallback(async (message) => {
    const msg = message?.trim();
    if (!msg || !sessionIdRef.current || speakingRef.current || recordingRef.current) return;

    pushMessage('user', msg, []);
    saveToLog('user', msg);

    const thinkingId = crypto.randomUUID();
    setMessages(prev => [...prev, {
      id: thinkingId, role: 'assistant', text: '', weakWords: [],
      pending: true, pronScore: null, pronFeedback: null,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }]);

    setSendDisabled(true);   // block double-send only
    // mic stays enabled — user can speak while Alex types
    setStatus({ text: s('Le coach répond…', 'The coach is replying…'), type: 'loading' });

    const fd = new FormData();
    fd.append('session_id', sessionIdRef.current);
    fd.append('message',    msg);
    fd.append('lang',       langRef.current);
    const masterSidText = localStorage.getItem('masterSessionId');
    if (masterSidText) fd.append('master_session_id', masterSidText);

    let textCompleted = false;
    try {
      let accumulated = '';
      let firstToken = true;

      for await (const { event, data } of fetchSse(`${BASE}/text-sse`, fd)) {
        if (event === 'token') {
          if (firstToken) {
            firstToken = false;
            setSendDisabled(false); // re-enable send as soon as streaming starts
          }
          accumulated += data.text ?? '';
          updateMessage(thinkingId, { text: accumulated, pending: true });

        } else if (event === 'complete') {
          textCompleted = true;
          const response = data.response ?? accumulated;
          updateMessage(thinkingId, { text: response, pending: false });
          saveToLog('assistant', response);
          if (data.audio_base64) await playAudio(data.audio_base64);
          setReady();
          break; // stream closed — exit immediately

        } else if (event === 'error') {
          setMessages(prev => prev.filter(m => m.id !== thinkingId));
          const txtMsg = data.error === 'TIMEOUT'
            ? s('Délai dépassé — réessayez', 'Response timed out — try again')
            : s('Erreur serveur — réessayez', 'Server error — try again');
          setStatus({ text: txtMsg, type: 'error' });
          setTimeout(setReady, 3000);
          setSendDisabled(false);
          return;
        }
      }
    } catch (err) {
      console.error('[SpeakCoach] text-sse:', err);
      setMessages(prev => prev.filter(m => m.id !== thinkingId));
      if (err.message?.includes('404') || err.status === 404) {
        setStatus({ text: s('Session expirée — reconnexion…', 'Session expired — reconnecting…'), type: 'loading' });
        await startSession(new AbortController().signal);
        return;
      }
      setStatus({ text: s('Erreur serveur — réessayez', 'Server error — try again'), type: 'error' });
      setTimeout(setReady, 3000);
      setSendDisabled(false);
    } finally {
      if (!textCompleted) {
        setSendDisabled(false);
        setMicDisabled(false);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Toggle mic ─────────────────────────────────────────────────────────────
  const toggleRecording = useCallback(() => {
    if (!sessionIdRef.current) return;
    if (recordingRef.current) stopRecording();
    else                       startRecording();
  }, [startRecording, stopRecording]);

  // ── Cleanup ────────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopAnimation();
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    sessionId,
    status, isRecording, isSpeaking,
    messages, micDisabled, sendDisabled,
    toggleRecording, sendText,
    audioEl, svg,
    historyKey,   // so Avatar can read localStorage log
  };
}
