# main.py — Serveur FastAPI SpeakCoach
# ─────────────────────────────────────────────────────────────────────────────
# Routes actives :
#   GET  /health
#   POST /analyze        — STT Whisper + word_diff (score/feedback calculés par Spring)
#   /api/chat/stt        — STT Whisper (appelé par Spring ChatbotController)
#   /api/chat/tts        — edge-TTS   (appelé par Spring ChatbotController)
#   /debug/logs|status|test
#
# Score, feedback, exercices : gérés par Spring Boot (OllamaService, PracticeService)

from __future__ import annotations
import asyncio, uuid, logging, time, os
try:
    import psutil
except ImportError:
    psutil = None
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Optional

import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, Request
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)
logger = logging.getLogger("SpeakCoach")

from audio_engine import (
    load_whisper,
    preprocess_audio,
    transcribe_audio,
    word_diff,
)
from chatbot_router import register_chatbot_routes
from phonemizer_utils import get_phonemes, compare_phonemes

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="SpeakCoach API")

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    rid = str(uuid.uuid4())[:8]
    
    # Ne pas polluer les logs avec les requêtes de monitoring récurrentes
    is_monitoring = request.url.path in ["/health", "/metrics", "/debug/logs", "/debug/status"]
    
    if not is_monitoring:
        logger.info(f"[{rid}] {request.method} {request.url.path}")
        
    try:
        response = await call_next(request)
        if not is_monitoring:
            logger.info(f"[{rid}] {response.status_code} ({time.time()-start_time:.2f}s)")
        return response
    except Exception as e:
        logger.error(f"[{rid}] ERROR {request.url.path} - {e} ({time.time()-start_time:.2f}s)")
        raise

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

whisper_model:      Any           = None
whisper_load_error: Optional[str] = None
executor = ThreadPoolExecutor(max_workers=6)


def _ensure_whisper():
    if whisper_model is None:
        raise HTTPException(503, whisper_load_error or "Whisper non chargé")


# ── Startup ───────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup_event():
    global whisper_model, whisper_load_error
    try:
        print("[Startup] Chargement Whisper...")
        whisper_model = load_whisper()
        print("[Startup] Whisper prêt")
    except Exception as e:
        whisper_load_error = str(e)
        print(f"[Startup] Whisper ECHEC : {e}")

    register_chatbot_routes(
        app                = app,
        executor           = executor,
        base_whisper_model = whisper_model,
    )
    print("[Startup] Routes chatbot STT/TTS OK (/api/chat/stt, /api/chat/tts)")


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {
        "status":  "UP",
        "whisper": "loaded" if whisper_model else f"error:{whisper_load_error}",
    }

@app.get("/metrics")
def metrics():
    if psutil is None:
        return {"error": "psutil not installed"}
    
    process = psutil.Process(os.getpid())
    return {
        "cpu_percent": psutil.cpu_percent(interval=None),
        "ram_usage_mb": round(process.memory_info().rss / (1024 * 1024), 2),
        "ram_total_mb": round(psutil.virtual_memory().total / (1024 * 1024), 2),
        "ram_percent": psutil.virtual_memory().percent,
        "whisper_status": "loaded" if whisper_model else "not_loaded",
        "timestamp": time.time()
    }


# ═════════════════════════════════════════════════════════════════════════════
# /analyze — STT Whisper + word_diff
# Score, feedback et XP calculés par Spring Boot (PracticeService + OllamaService)
# ═════════════════════════════════════════════════════════════════════════════
@app.post("/analyze")
@app.post("/api/exercises/analyze")
async def analyze(
    file:           UploadFile = File(...),
    expectedPhrase: str        = Form(...),
    lang:           str        = Form("fr"),
    level:          str        = Form("B1"),   # noqa: ARG001 — forwarded to Spring for scoring
):
    _ensure_whisper()
    rid = str(uuid.uuid4())[:8]

    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(400, "Fichier audio vide")

    logger.info(f"[{rid}] /analyze phrase='{expectedPhrase[:50]}' lang={lang}")

    try:
        audio, sr = preprocess_audio(audio_bytes)
    except ValueError as e:
        raise HTTPException(400, str(e))

    loop = asyncio.get_running_loop()
    stt  = await loop.run_in_executor(
        executor,
        lambda: transcribe_audio(audio, sr, lang, whisper_model)
    )

    if stt.get("is_silent") or stt.get("error"):
        err = stt.get("error", "SILENT_AUDIO")
        return {
            "transcript": "", "raw_transcript": "", "clean_transcript": "",
            "wer": 1.0, "f1": 0.0, "precision": 0.0, "recall": 0.0,
            "word_diff_score": 0, "avg_confidence": 0.0,
            "fillers_found": [], "ops": [],
            "n_match": 0, "n_sub": 0, "n_del": 0, "n_ins": 0,
            "words": [],
            "language_prob": 0.0, "duration": 0.0, "rms_energy": 0.0,
            "stt_error": True, "stt_error_code": err, "stt_error_message": None,
        }

    clean = stt.get("clean_text", "")
    diff  = word_diff(expectedPhrase, clean, lang=lang)

    # Analyse phonétique : compare phonèmes attendus vs confiance Whisper mot par mot
    words = stt.get("words", [])
    phoneme_data   = get_phonemes(expectedPhrase, lang)
    phoneme_issues = compare_phonemes(
        phoneme_data["ipa"], words, phoneme_data["words"], lang
    )

    # ── Détection prononciation incomplète ────────────────────────────────────
    # Si l'audio est trop court pour le nombre de mots attendus, l'utilisateur
    # n'a pas dit la phrase entière. Seuil : 0.25 s minimum par mot (parole rapide).
    duration_val     = stt.get("duration", 0.0)
    n_match          = diff["n_match"]
    n_sub            = diff["n_sub"]
    n_del            = diff["n_del"]
    n_ins            = diff["n_ins"]
    words_transcribed = n_match + n_sub + n_ins
    n_expected        = len(expectedPhrase.split())
    words_per_second  = words_transcribed / max(duration_val, 0.1)
    min_duration      = n_expected * 0.25   # 0.25 s/mot = parole très rapide
    suspected_hallucination = (
        # Audio clairement trop court pour contenir tous les mots
        duration_val < min_duration
        or (
            # Ou débit physiologiquement improbable (> 4 mots/s)
            words_per_second > 4.0
            and duration_val < 5.0
            and words_transcribed > 3
        )
    )
    coverage_ratio = round((n_match + n_sub) / max(n_expected, 1), 3)

    return {
        "transcript":        clean,
        "raw_transcript":    stt.get("raw_text", ""),
        "clean_transcript":  clean,
        "wer":               round(diff["wer"], 4),
        "f1":                diff["f1"],
        "precision":         diff["precision"],
        "recall":            diff["recall"],
        "word_diff_score":   diff["score"],
        "avg_confidence":    round(stt.get("avg_confidence", 0.0), 3),
        "fillers_found":     stt.get("fillers_found", []),
        "ops":               diff["ops"],
        "n_match":           n_match,
        "n_sub":             n_sub,
        "n_del":             n_del,
        "n_ins":             n_ins,
        "n_expected":        n_expected,
        "coverage_ratio":    coverage_ratio,
        "suspected_hallucination": suspected_hallucination,
        "words":             words,
        # ── Phonétique ────────────────────────────────────────────────────
        "phonemes": {
            "expected_ipa":   phoneme_data["ipa"],
            "source":         phoneme_data["source"],
            "word_phonemes":  phoneme_issues,   # [{word, ipa, confidence, issue}]
            "weak_phonemes":  [p for p in phoneme_issues if p["issue"]],
        },
        # ─────────────────────────────────────────────────────────────────
        "language_prob":     round(stt.get("language_prob", 0.0), 3),
        "duration":          stt.get("duration", 0.0),
        "rms_energy":        stt.get("rms_energy", 0.0),
        "stt_error":         False,
        "stt_error_code":    None,
        "stt_error_message": None,
    }


# ═════════════════════════════════════════════════════════════════════════════
# /phonemes — G2P : phonèmes attendus pour une phrase (sync, pas d'audio)
# Appelé par Spring pour enrichir le feedback du test de niveau et des exercices
# ═════════════════════════════════════════════════════════════════════════════
@app.post("/phonemes")
async def phonemes_route(
    text: str = Form(...),
    lang: str = Form("fr"),
):
    """Retourne la transcription IPA d'une phrase — utile pour le feedback phonétique."""
    result = get_phonemes(text, lang)
    return result


@app.get("/phonemes")
async def phonemes_get(
    text: str,
    lang: str = "fr",
):
    """GET version pour tests rapides depuis le navigateur."""
    return get_phonemes(text, lang)


# ── Debug (dev only) ──────────────────────────────────────────────────────────
DEBUG_LOGS = []

class _DebugHandler(logging.Handler):
    def emit(self, record):
        DEBUG_LOGS.append(self.format(record))
        if len(DEBUG_LOGS) > 100:
            DEBUG_LOGS.pop(0)

_h = _DebugHandler()
_h.setFormatter(logging.Formatter('[%(asctime)s] %(levelname)s: %(message)s'))
logger.addHandler(_h)

@app.get("/debug/logs")
def debug_logs(last: int = 50):
    return {"total": len(DEBUG_LOGS), "latest": DEBUG_LOGS[-last:]}

@app.get("/debug/status")
def debug_status():
    return {"status": "OK", "whisper_loaded": whisper_model is not None,
            "timestamp": time.time()}

@app.get("/debug/test")
def debug_test():
    logger.info("DEBUG TEST called")
    return {"message": "API active"}


# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, access_log=True)
