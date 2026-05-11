import { useState, useRef, useCallback } from 'react';

function getBestMimeType() {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) || '';
}

/**
 * Convertit un Blob audio (webm/ogg/mp4) en WAV PCM 16-bit mono 16kHz.
 * Soundfile (Python) lit le WAV nativement → meilleure transcription Whisper.
 */
async function blobToWav(blob, audioCtx) {
  const arrayBuffer = await blob.arrayBuffer();
  const decoded = await audioCtx.decodeAudioData(arrayBuffer);

  const sampleRate = decoded.sampleRate;
  const pcm = decoded.getChannelData(0); // mono
  const samples = new Int16Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) {
    samples[i] = Math.max(-32768, Math.min(32767, Math.round(pcm[i] * 32767)));
  }

  const dataLen = samples.length * 2;
  const buf = new ArrayBuffer(44 + dataLen);
  const v = new DataView(buf);
  const str = (off, s) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); };

  str(0, 'RIFF'); v.setUint32(4, 36 + dataLen, true);
  str(8, 'WAVE'); str(12, 'fmt '); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);        // PCM
  v.setUint16(22, 1, true);        // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, dataLen, true);
  new Int16Array(buf, 44).set(samples);

  return new Blob([buf], { type: 'audio/wav' });
}

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const chunksRef = useRef([]);
  const stopResolveRef = useRef(null);
  const audioCtxRef = useRef(null);

  /* ── Start ─────────────────────────────────────────────────── */
  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setAudioBlob(null);
      chunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // ── Audio Context & Analysis ──
      // Use a consistent sample rate (16kHz) for speech processing
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = audioCtx;
      
      const source = audioCtx.createMediaStreamSource(stream);
      
      // GainNode to boost signal BEFORE recording and analysis
      const gainNode = audioCtx.createGain();
      gainNode.gain.value = 2.5; // Moderate boost
      source.connect(gainNode);

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      gainNode.connect(analyser); // Analyze the boosted signal for UI
      analyserRef.current = analyser;

      // ── MediaStreamDestination to capture the boosted audio ──
      const dest = audioCtx.createMediaStreamDestination();
      gainNode.connect(dest);

      // ── MediaRecorder on the BOOSTED destination stream ──
      const mimeType = getBestMimeType();
      const recorder = new MediaRecorder(dest.stream, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const finalMime = mimeType || 'audio/webm';
        const rawBlob = new Blob(chunksRef.current, { type: finalMime });

        // Stop tracks & UI
        stream.getTracks().forEach((t) => t.stop());
        cancelAnimationFrame(animFrameRef.current);
        setAudioLevel(0);

        // Convertir en WAV pour que soundfile (Python) le lise nativement
        let finalBlob = rawBlob;
        try {
          finalBlob = await blobToWav(rawBlob, audioCtxRef.current);
        } catch {
          // WAV conversion failed — send original format
        }

        if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
          audioCtxRef.current.close().catch(console.error);
        }

        setAudioBlob(finalBlob);
        if (stopResolveRef.current) {
          stopResolveRef.current(finalBlob);
          stopResolveRef.current = null;
        }
      };

      // Start with timeslice to avoid data loss
      recorder.start(100);
      setIsRecording(true);

      const updateLevel = () => {
        if (!analyserRef.current) return;
        const data = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        // Apply a small threshold and scale to make the UI wave more reactive
        const level = Math.min(1, (avg / 128)); 
        setAudioLevel(level);
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
    chunksRef.current = [];
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
