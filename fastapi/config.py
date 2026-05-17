# config.py — Configuration centrale FastAPI SpeakCoach
import os

# ── Modèles Whisper ───────────────────────────────────────────────────────────
# En local GPU : WHISPER_DEVICE=cuda WHISPER_COMPUTE_TYPE=float16
# En Docker CPU : WHISPER_DEVICE=cpu  WHISPER_COMPUTE_TYPE=int8  (via env vars)
WHISPER_MODEL        = os.getenv("WHISPER_MODEL", "small")
WHISPER_DEVICE       = os.getenv("WHISPER_DEVICE", "cuda")
WHISPER_COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "float16")

CHATBOT_WHISPER_MODEL = os.getenv("CHATBOT_WHISPER_MODEL", "small")

SAMPLE_RATE = 16_000
