# chatbot_router.py — STT Whisper + TTS edge-tts pour le chatbot
# Routes : POST /api/chat/stt  (appelé par Spring ChatbotController)
#          POST /api/chat/tts  (appelé par Spring ChatbotController)
from __future__ import annotations

import asyncio
import base64
import logging
import os
import tempfile
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

import librosa
import numpy as np
import soundfile as sf
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from whisper_lock import whisper_transcribe_lock as _whisper_transcription_lock

logger = logging.getLogger("SpeakCoach.Chatbot")

# ── Whisper initial prompts par langue ───────────────────────────────────────
_WHISPER_INITIAL_PROMPTS = {
    "fr": "Bonjour, je parle français.",
    "en": "Hello, I am speaking English.",
   
}

# Mots fonctionnels exclus du calcul des mots faibles
_FUNCTION_WORDS = {
    "fr": {"je","tu","il","elle","on","nous","vous","ils","elles","le","la","les",
           "un","une","des","du","de","en","et","est","son","sa","ses","mon","ma",
           "mes","ce","y","me","te","lui","se","ne","pas","plus","si","ou","et","à"},
    "en": {"i","my","me","we","you","he","she","it","they","the","a","an","is",
           "am","are","was","were","be","been","to","of","in","and","or","but",
           "not","do","did","have","has","had","will","would","can","could","so"},
}

# ── Whisper models ────────────────────────────────────────────────────────────
_chatbot_whisper:       Optional[object] = None
_chatbot_whisper_small: Optional[object] = None
_executor:              Optional[ThreadPoolExecutor] = None


def set_base_whisper(model) -> None:
    global _chatbot_whisper
    _chatbot_whisper = model
    logger.info("[Chatbot] Whisper base injecté — STT prêt")


def _load_whisper_small() -> None:
    global _chatbot_whisper_small
    try:
        from faster_whisper import WhisperModel
        from config import CHATBOT_WHISPER_MODEL, WHISPER_DEVICE, WHISPER_COMPUTE_TYPE
        logger.info(f"[Chatbot] Chargement Whisper {CHATBOT_WHISPER_MODEL}…")
        _chatbot_whisper_small = WhisperModel(
            CHATBOT_WHISPER_MODEL, device=WHISPER_DEVICE, compute_type=WHISPER_COMPUTE_TYPE,
        )
        logger.info(f"[Chatbot] Whisper {CHATBOT_WHISPER_MODEL} prêt")
    except Exception as exc:
        logger.warning(f"[Chatbot] Whisper small indisponible ({exc}) — base utilisé en fallback")


def _get_best_whisper():
    return _chatbot_whisper_small or _chatbot_whisper


def register_chatbot_routes(app, executor: ThreadPoolExecutor,
                             base_whisper_model=None, **_kwargs) -> None:
    global _executor
    _executor = executor
    if base_whisper_model is not None:
        set_base_whisper(base_whisper_model)
    import concurrent.futures as _cf
    _cf.ThreadPoolExecutor(max_workers=1).submit(_load_whisper_small)
    app.include_router(router)
    logger.info("[Chatbot] Routes STT/TTS enregistrées (/api/chat/stt, /api/chat/tts)")


# ── Audio preprocessing ───────────────────────────────────────────────────────

def _preprocess_chatbot_audio(audio_bytes: bytes):
    import subprocess, shutil

    suffix = ".webm"
    if audio_bytes[:4] == b"RIFF":   suffix = ".wav"
    elif audio_bytes[:4] == b"OggS": suffix = ".ogg"
    elif audio_bytes[:3] == b"ID3" or audio_bytes[:2] == b"\xff\xfb": suffix = ".mp3"

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(audio_bytes)
        src_path = tmp.name

    wav_path = src_path + "_chat.wav"
    try:
        if shutil.which("ffmpeg"):
            result = subprocess.run(
                ["ffmpeg", "-y", "-i", src_path, "-af", "highpass=f=80",
                 "-ar", "16000", "-ac", "1", "-f", "wav", wav_path],
                capture_output=True, timeout=15
            )
            if result.returncode == 0 and os.path.exists(wav_path):
                y, sr = librosa.load(wav_path, sr=16_000, mono=True)
            else:
                y, sr = librosa.load(src_path, sr=16_000, mono=True)
        else:
            y, sr = librosa.load(src_path, sr=16_000, mono=True)
    finally:
        os.unlink(src_path)
        if os.path.exists(wav_path):
            os.unlink(wav_path)

    if len(y) < sr * 0.2:
        raise ValueError("Enregistrement trop court (< 0.2 s) — réessaie.")

    rms_before = float(np.sqrt(np.mean(y ** 2)))
    TARGET_RMS = 0.06
    if rms_before < 0.005:
        mx = float(np.max(np.abs(y)))
        if mx > 1e-6:
            y = y / mx * 0.95
    elif rms_before < TARGET_RMS:
        y = np.clip(y * min(15.0, TARGET_RMS / rms_before), -1.0, 1.0)
    else:
        mx = float(np.max(np.abs(y)))
        if mx > 0:
            y = y / mx * 0.9

    if len(y) / sr < 3.0:
        pad = np.zeros(int(sr * 0.5), dtype=np.float32)
        y = np.concatenate([pad, y, pad])

    return y.astype(np.float32), sr


def _is_hallucination(text: str, audio_duration: float = 9999.0) -> bool:
    from collections import Counter
    words = text.lower().split()
    n = len(words)
    if audio_duration < 2.0 and n > 4:  return True
    if audio_duration < 3.0 and n > 6:  return True
    if audio_duration > 0 and audio_duration < 5.0 and n / audio_duration > 4.0: return True
    if n >= 8:
        stop = {"de","la","le","les","des","et","en","a","un","une","que","qui",
                "the","of","is","a","an","in","and","to","it","that"}
        counts = Counter(w for w in words if w not in stop)
        if counts and counts.most_common(1)[0][1] / n > 0.40: return True
        bigrams = list(zip(words, words[1:]))
        if bigrams and len(set(bigrams)) / len(bigrams) < 0.30:  return True
    hallucinations = ["c'est la première fois","merci d'avoir regardé","sous-titres",
                      "prochaine vidéo","musique","applaudissements","générique","rires"]
    return any(h in text.lower() for h in hallucinations)


def _is_punctuation_only(text: str) -> bool:
    import re
    return bool(re.fullmatch(r'[\s\.\,\!\?\;\:\-\—\–\…\'\"\«\»\(\)]*', text))


def _whisper_transcribe_once(tmp_path, lang, whisper_model, beam_size, temperature, initial_prompt):
    with _whisper_transcription_lock:
        segs, info = whisper_model.transcribe(
            tmp_path, language=lang, beam_size=beam_size, best_of=1,
            temperature=temperature, vad_filter=True, word_timestamps=True,
            condition_on_previous_text=False, no_speech_threshold=0.6,
            log_prob_threshold=-2.5, compression_ratio_threshold=2.4,
            initial_prompt=initial_prompt,
        )
        return list(segs), info


def _transcribe_chatbot(audio: np.ndarray, sr: int, lang: str, whisper_model):
    rms = float(np.sqrt(np.mean(audio ** 2)))
    if rms < 0.000005:
        return {"error": "SILENT_AUDIO", "clean_text": "", "words": [], "avg_confidence": 0.0}

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        sf.write(tmp.name, audio, sr)
        tmp_path = tmp.name

    duration        = len(audio) / sr
    initial_prompt  = _WHISPER_INITIAL_PROMPTS.get(lang, _WHISPER_INITIAL_PROMPTS["fr"])

    try:
        segs, _ = _whisper_transcribe_once(tmp_path, lang, whisper_model,
                                           beam_size=1, temperature=0.0,
                                           initial_prompt=initial_prompt)
        result = _extract_transcription(segs, pass_num=1, audio_duration=duration)

        if result.get("error") and rms > 0.01 and duration >= 0.5:
            segs2, _ = _whisper_transcribe_once(tmp_path, lang, whisper_model,
                                                beam_size=2, temperature=(0.0,0.2,0.4,0.6,0.8),
                                                initial_prompt=initial_prompt)
            result2 = _extract_transcription(segs2, pass_num=2, audio_duration=duration)
            if not result2.get("error"):
                result = result2
        return result
    finally:
        os.unlink(tmp_path)


def _extract_transcription(raw_segs, pass_num=1, audio_duration=9999.0):
    if not raw_segs:
        return {"error": "SILENT_AUDIO", "clean_text": "", "words": [], "avg_confidence": 0.0}

    valid = [s for s in raw_segs if getattr(s, "no_speech_prob", 0) < 0.88]
    if not valid:
        return {"error": "SILENT_AUDIO", "clean_text": "", "words": [], "avg_confidence": 0.0}

    text = " ".join(s.text.strip() for s in valid).strip()
    if not text or _is_punctuation_only(text):
        return {"error": "SILENT_AUDIO", "clean_text": "", "words": [], "avg_confidence": 0.0}
    if _is_hallucination(text, audio_duration):
        return {"error": "SILENT_AUDIO", "clean_text": "", "words": [], "avg_confidence": 0.0}

    words = [
        {"word": w.word.strip(), "probability": round(w.probability, 3)}
        for seg in valid if hasattr(seg, "words") and seg.words
        for w in seg.words if w.word.strip()
    ]
    avg_conf = sum(w["probability"] for w in words) / len(words) if words else 0.0

    if avg_conf < 0.35 and words:
        return {"error": "LOW_CONFIDENCE", "clean_text": "", "words": [], "avg_confidence": avg_conf}

    logger.info(f"[Chatbot STT] Pass {pass_num} OK: '{text[:70]}' conf={avg_conf:.2f}")
    return {"error": None, "clean_text": text, "words": words, "avg_confidence": round(avg_conf, 3)}


def _extract_weak_words(stt: dict, lang: str, avg_conf: float) -> list:
    if avg_conf < 0.5:
        return []
    stop = _FUNCTION_WORDS.get(lang, _FUNCTION_WORDS["en"])
    return [
        w["word"].strip(".,!?") for w in stt.get("words", [])
        if w.get("probability", 1.0) < 0.45
        and w["word"].strip(".,!? ").lower() not in stop
        and len(w["word"].strip(".,!? ")) > 1
    ]


# ── TTS ───────────────────────────────────────────────────────────────────────

_TTS_VOICES: dict = {
    "fr": "fr-FR-DeniseNeural",
    "en": "en-US-JennyNeural",
    "es": "es-ES-ElviraNeural",
    "de": "de-DE-KatjaNeural",
}


async def _safe_tts(text: str, lang: str) -> str:
    import io
    import edge_tts
    try:
        voice     = _TTS_VOICES.get(lang, _TTS_VOICES["fr"])
        communicate = edge_tts.Communicate(text, voice)
        buf = io.BytesIO()
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                buf.write(chunk["data"])
        return base64.b64encode(buf.getvalue()).decode()
    except Exception as exc:
        logger.warning(f"[Chatbot] TTS échoué : {exc}")
        return ""


# ── Router ────────────────────────────────────────────────────────────────────

router = APIRouter(prefix="/api/chat", tags=["chatbot"])


@router.post("/stt")
async def chat_stt(
    audio: UploadFile = File(...),
    lang:  str        = Form("fr"),
):
    """Whisper STT — appelé par Spring Boot (ChatbotController)."""
    whisper = _get_best_whisper()
    if whisper is None:
        raise HTTPException(503, "Whisper non disponible")

    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(400, "Fichier audio vide")

    loop = asyncio.get_running_loop()
    try:
        y, sr = await loop.run_in_executor(_executor, lambda: _preprocess_chatbot_audio(audio_bytes))
    except ValueError as exc:
        return {"error": str(exc), "retry": True, "clean_text": "", "weak_words": [], "avg_confidence": 0.0}
    except Exception:
        return {"error": "Erreur décodage audio.", "retry": True, "clean_text": "", "weak_words": [], "avg_confidence": 0.0}

    stt = await loop.run_in_executor(_executor, lambda: _transcribe_chatbot(y, sr, lang, whisper))

    if stt.get("error"):
        msg = ("Je n'ai pas bien compris — réessaie."
               if lang == "fr" else "I didn't understand — please repeat.")
        return {"error": msg, "retry": True, "clean_text": "", "weak_words": [], "avg_confidence": 0.0}

    avg_conf   = stt.get("avg_confidence", 1.0)
    weak_words = _extract_weak_words(stt, lang, avg_conf)
    pron_score = round(avg_conf * 100)
    pron_feedback = (
        "excellent"  if len(weak_words) == 0 and avg_conf >= 0.80 else
        "good"       if len(weak_words) == 0 and avg_conf >= 0.65 else
        "fair"       if len(weak_words) <= 1  or avg_conf >= 0.55 else
        "needs_work"
    )

    return {
        "clean_text":     stt.get("clean_text", ""),
        "weak_words":     weak_words,
        "avg_confidence": round(avg_conf, 3),
        "pron_score":     pron_score,
        "pron_feedback":  pron_feedback,
        "error":          None,
    }


@router.post("/tts")
async def chat_tts(
    text: str = Form(...),
    lang: str = Form("fr"),
):
    """edge-TTS — appelé par Spring Boot (ChatbotController)."""
    audio_b64 = await _safe_tts(text, lang)
    return {"audio_base64": audio_b64, "audio_format": "mp3"}
