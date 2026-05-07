# whisper_lock.py — Verrou global pour sérialiser les appels Whisper
# Faster-Whisper n'est pas thread-safe : deux appels simultanés à .transcribe()
# peuvent corrompre l'état interne du modèle ONNX. Ce verrou garantit qu'un
# seul thread transcrit à la fois (exercices, CEFR, chatbot).
import threading

whisper_transcribe_lock = threading.Lock()
