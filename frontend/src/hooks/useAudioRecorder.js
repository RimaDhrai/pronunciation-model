import { useState, useRef, useCallback, useEffect } from 'react';

function getBestMimeType() {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) || '';
}

// Build a valid WAV from raw Float32 PCM samples (no async, no decoding needed)
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

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob]     = useState(null);
  const [audioLevel, setAudioLevel]   = useState(0);
  const [error, setError]             = useState(null);

  const mediaRecorderRef = useRef(null);
  const analyserRef      = useRef(null);
  const animFrameRef     = useRef(null);
  const chunksRef        = useRef([]);       // MediaRecorder fallback
  const stopResolveRef   = useRef(null);
  const audioCtxRef      = useRef(null);
  const pcmChunksRef     = useRef([]);       // Primary: raw PCM from ScriptProcessor
  const scriptNodeRef    = useRef(null);
  const streamRef        = useRef(null);

  // Cleanup on unmount — prevents RAF and AudioContext leaks across page navigations
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      if (scriptNodeRef.current) {
        scriptNodeRef.current.onaudioprocess = null;
        try { scriptNodeRef.current.disconnect(); } catch { /* ignore */ }
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      if (audioCtxRef.current?.state !== 'closed') {
        audioCtxRef.current?.close().catch(() => {});
      }
      analyserRef.current = null;
    };
  }, []);

  /* ── Start ─────────────────────────────────────────────────── */
  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setAudioBlob(null);
      chunksRef.current    = [];
      pcmChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl:  true,
          channelCount:     1,
        },
      });
      streamRef.current = stream;

      // AudioContext at 16 kHz — analyser + PCM capture (independent from MediaRecorder)
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = audioCtx;
      if (audioCtx.state === 'suspended') await audioCtx.resume();

      const source   = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // ScriptProcessorNode: captures raw PCM at the AudioContext sample rate (16 kHz)
      // This is the primary WAV source — avoids unreliable decodeAudioData on webm blobs
      const scriptNode = audioCtx.createScriptProcessor(2048, 1, 1);
      scriptNodeRef.current = scriptNode;
      scriptNode.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        pcmChunksRef.current.push(new Float32Array(input));
      };
      // Route: analyser → scriptNode → muted gain → destination (keeps graph active)
      analyser.connect(scriptNode);
      const muteGain = audioCtx.createGain();
      muteGain.gain.value = 0; // silent — prevents speaker echo
      scriptNode.connect(muteGain);
      muteGain.connect(audioCtx.destination);

      // MediaRecorder on raw mic stream — fallback only (timing + onstop event)
      const mimeType = getBestMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        // Freeze PCM capture before reading (avoid partial last chunk race)
        if (scriptNodeRef.current) {
          scriptNodeRef.current.onaudioprocess = null;
          try { scriptNodeRef.current.disconnect(); } catch { /* ignore */ }
        }

        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        cancelAnimationFrame(animFrameRef.current);
        setAudioLevel(0);

        const capturedSR = audioCtx.sampleRate;
        if (audioCtx.state !== 'closed') audioCtx.close().catch(() => {});

        // Build WAV from captured PCM (preferred — no decoding, guaranteed audio content)
        let finalBlob;
        const pcmChunks = pcmChunksRef.current;
        if (pcmChunks.length > 0) {
          const total  = pcmChunks.reduce((s, c) => s + c.length, 0);
          const allPcm = new Float32Array(total);
          let off = 0;
          for (const chunk of pcmChunks) { allPcm.set(chunk, off); off += chunk.length; }
          finalBlob = pcmToWav(allPcm, capturedSR);
        } else {
          // Fallback: raw MediaRecorder blob (FastAPI uses ffmpeg to decode)
          finalBlob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
        }

        setAudioBlob(finalBlob);
        if (stopResolveRef.current) {
          stopResolveRef.current(finalBlob);
          stopResolveRef.current = null;
        }
      };

      recorder.start(100);
      setIsRecording(true);

      const updateLevel = () => {
        if (!analyserRef.current) return;
        const data = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setAudioLevel(Math.min(1, avg / 128));
        animFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();
    } catch {
      setError('Accès microphone refusé ou erreur technique.');
    }
  }, []);

  /* ── Stop ──────────────────────────────────────────────────── */
  const stopRecording = useCallback(() => {
    return new Promise((resolve) => {
      stopResolveRef.current = resolve;
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        recorder.stop();
        setIsRecording(false);
      } else {
        resolve(null);
      }
    });
  }, []);

  /* ── Helpers ───────────────────────────────────────────────── */
  const toBase64 = useCallback(async () => {
    if (!audioBlob) return null;
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(audioBlob);
    });
  }, [audioBlob]);

  const resetRecording = useCallback(() => {
    setAudioBlob(null);
    setError(null);
    setAudioLevel(0);
    chunksRef.current    = [];
    pcmChunksRef.current = [];
  }, []);

  return {
    isRecording,
    audioBlob,
    audioLevel,
    error,
    startRecording,
    stopRecording,
    resetRecording,
    toBase64,
  };
}
