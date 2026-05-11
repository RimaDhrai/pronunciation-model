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

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const analyserRef      = useRef(null);
  const animFrameRef     = useRef(null);
  const chunksRef        = useRef([]);
  const stopResolveRef   = useRef(null);
  const audioCtxRef      = useRef(null);

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

      // ── AudioContext only for waveform analyser (not for recording) ──
      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const source   = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // ── MediaRecorder on the RAW mic stream (most reliable) ──
      const mimeType = getBestMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const finalMime = mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: finalMime });

        stream.getTracks().forEach((t) => t.stop());
        cancelAnimationFrame(animFrameRef.current);
        setAudioLevel(0);

        if (audioCtxRef.current?.state !== 'closed') {
          audioCtxRef.current.close().catch(() => {});
        }

        setAudioBlob(blob);
        if (stopResolveRef.current) {
          stopResolveRef.current(blob);
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
