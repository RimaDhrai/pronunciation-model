# ── FastAPI + Whisper (CPU) ────────────────────────────────────────────────────
# GPU version: change base to nvidia/cuda:12.1.1-cudnn8-runtime-ubuntu22.04
FROM python:3.11-slim

WORKDIR /app

# System deps: espeak-ng (phonemizer), ffmpeg (audio decode), libsndfile (soundfile)
RUN apt-get update && apt-get install -y --no-install-recommends \
        espeak-ng \
        ffmpeg \
        libsndfile1 \
        libgomp1 \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download Whisper base model so first request is fast
RUN python -c "from faster_whisper import WhisperModel; WhisperModel('base', device='cpu', compute_type='int8'); print('Whisper base downloaded')"

COPY . .

# CPU defaults (override with --gpus in docker run for GPU)
ENV WHISPER_DEVICE=cpu
ENV WHISPER_COMPUTE_TYPE=int8

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
