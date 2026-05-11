# audio_engine.py — Traitement audio : Whisper STT, word_diff, feedback
# Audio preprocessing, Whisper transcription, text utilities,
# weighted word_diff, feedback for exercises, score_message helper.

import os, re, tempfile, unicodedata
from typing import Any, Dict, List, Tuple

import numpy as np
import librosa
import soundfile as sf
import noisereduce as nr
from scipy.signal import butter, sosfilt
from jiwer import wer as jiwer_wer
from faster_whisper import WhisperModel
# ── Configuration (centralisée dans config.py) ─────────────────────────────────
from config import (
    WHISPER_MODEL, WHISPER_DEVICE, WHISPER_COMPUTE_TYPE, SAMPLE_RATE,
)

# Anti-hallucination thresholds
SILENCE_RMS_THRESHOLD    = 0.005
SILENCE_SPEECH_RATIO     = 0.10
LOW_CONFIDENCE_THRESHOLD = 0.30
LOW_CONF_MAX_WORDS       = 3
# Below this RMS, initial_prompt is suppressed to avoid Whisper hallucinating the expected phrase
SUSPICIOUS_RMS_THRESHOLD = 0.015

FILLER_WORDS = {
    "fr": {
        "euh","hm","hmm","bah","ben","beh","voila","genre","quoi","enfin",
        "donc","bon","ah","oh","hein","nan","ouais",
    },
    "en": {
        "um","uh","uhm","hmm","hm","er","ah","oh","like","you know",
        "i mean","basically","literally","right","okay","so","well","actually",
    },
}

HALLUCINATION_PATTERNS = [
    r"^\s*$",
    r"^(merci|thank you|thanks|gracias)\.?$",
    r"^sous-titres?\s",
    r"^(www\.|http)",
    r"^\[.*\]$",
    r"^(music|musique|applause|applaudissements)$",
    r"^\.{2,}$",
]

# ── Function words — weighted scoring ─────────────────────────────────────────
# Content words carry more weight; function words carry less.
FUNCTION_WORDS = {
    "fr": {
        "le","la","les","un","une","des","du","de","en","et","est","son","sa",
        "ses","mon","ma","mes","ce","qui","que","dans","sur","avec","pour","au",
        "aux","par","mais","ou","ne","pas","plus","tres","bien","tout","ce","cet",
        "cette","ici","aussi","quand","comment","y","on","se","je","tu","il",
        "elle","nous","vous","ils","elles","me","te","lui","leur","dont",
    },
    "en": {
        "the","a","an","is","are","was","were","i","you","he","she","we","they",
        "it","of","in","to","and","that","this","have","has","with","for","on",
        "at","by","from","do","does","be","been","had","will","would","could",
        "should","may","might","can","not","but","if","or","as","so","up","out",
        "no","just","very","well","do","did","its","my","your","his","her","our",
        "their","am","all","me","him","us","them",
    },
}

FUNCTION_WORD_WEIGHT = 0.4   # function words count 40% vs 100% for content words


def get_word_weight(word: str, lang: str = "fr") -> float:
    fw = FUNCTION_WORDS.get(lang, FUNCTION_WORDS["fr"])
    return FUNCTION_WORD_WEIGHT if word.lower() in fw else 1.0


# ══════════════════════════════════════════════════════════════════════════════
# Audio preprocessing
# ══════════════════════════════════════════════════════════════════════════════

def bandpass_filter(audio: np.ndarray, sr: int, low: int = 80, high: int = 8000) -> np.ndarray:
    nyq = sr / 2.0
    low  = max(1, int(low))
    high = int(high)
    if high >= nyq:
        high = int(nyq - 1)
    if low >= high:
        return audio.astype(np.float32)
    sos = butter(6, [low, high], btype="bandpass", fs=sr, output="sos")
    return sosfilt(sos, audio).astype(np.float32)


def reduce_noise_audio(audio: np.ndarray, sr: int) -> np.ndarray:
    audio = bandpass_filter(audio, sr)
    duration = len(audio) / sr
    # Skip costly noisereduce for short clips (< 4s) — saves 0.5-1.5s per request
    if duration >= 4.0:
        n = min(int(0.5 * sr), len(audio) // 4)
        if n > 0:
            audio = nr.reduce_noise(
                y=audio, y_noise=audio[:n], sr=sr,
                stationary=False, prop_decrease=0.85,
                n_fft=512, win_length=512, hop_length=128,
            )
    mx = np.max(np.abs(audio))
    if mx > 0:
        audio = audio / mx * 0.95
    return audio.astype(np.float32)


def preprocess_audio(audio_bytes: bytes) -> Tuple[np.ndarray, int]:
    """Decode audio bytes, resample to SAMPLE_RATE, apply noise reduction."""
    suffix = ".webm"
    if audio_bytes[:4] == b"RIFF":
        suffix = ".wav"
    elif audio_bytes[:4] == b"OggS":
        suffix = ".ogg"
    elif audio_bytes[:3] == b"ID3" or audio_bytes[:2] == b"\xff\xfb":
        suffix = ".mp3"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name
    try:
        y, sr = librosa.load(tmp_path, sr=SAMPLE_RATE, mono=True)
    finally:
        os.unlink(tmp_path)
    if len(y) < sr * 0.3:
        raise ValueError("Audio trop court (< 0.3s). Reessaie.")
    return reduce_noise_audio(y, sr), sr


# ══════════════════════════════════════════════════════════════════════════════
# Whisper — CPU 
# ══════════════════════════════════════════════════════════════════════════════

_whisper_model = None


def load_whisper() -> WhisperModel:
    global _whisper_model
    if _whisper_model is None:
        device       = WHISPER_DEVICE
        compute_type = WHISPER_COMPUTE_TYPE
        try:
            print(f"[Whisper] Chargement '{WHISPER_MODEL}' sur {device} ({compute_type})...")
            _whisper_model = WhisperModel(
                WHISPER_MODEL,
                device=device,
                compute_type=compute_type,
                cpu_threads=min(8, os.cpu_count() or 4),
                num_workers=2,
            )
        except Exception as e:
            # CUDA unavailable or VRAM insufficient → fallback to CPU int8
            print(f"[Whisper] GPU indisponible ({e}), fallback CPU int8...")
            _whisper_model = WhisperModel(
                WHISPER_MODEL,
                device="cpu",
                compute_type="int8",
                cpu_threads=min(8, os.cpu_count() or 4),
                num_workers=2,
            )
        print("[Whisper] Pret [OK]")
    return _whisper_model


def is_silent_audio(audio: np.ndarray, sr: int) -> Tuple[bool, float]:
    rms    = float(np.sqrt(np.mean(audio ** 2)))
    fl     = int(sr * 0.02)
    frames = [audio[i : i + fl] for i in range(0, len(audio) - fl, fl)]
    if not frames:
        return True, rms
    active = sum(
        1 for f in frames
        if float(np.sqrt(np.mean(f ** 2))) > SILENCE_RMS_THRESHOLD
    )
    ratio = active / len(frames)
    cent  = float(np.mean(librosa.feature.spectral_centroid(y=audio, sr=sr)[0]))
    silent = (rms < SILENCE_RMS_THRESHOLD) or (ratio < SILENCE_SPEECH_RATIO)
    if not (200 < cent < 4000) and rms < 0.02:
        silent = True
    return silent, rms


def _is_hallucination(text: str) -> bool:
    t = text.strip().lower()
    return any(re.match(p, t, re.IGNORECASE) for p in HALLUCINATION_PATTERNS)


# Phrases Whisper appends to real speech on trailing silence/breath
HALLUCINATION_SUFFIXES = [
    r"[\s,\.]*[Ii]'?m\s+sorry[\.!,]?(\s+[Ii]'?m\s+sorry[\.!,]?)*\s*$",
    r"[\s,\.]*[Ss]orry[\.!,]?\s*$",
    r"[\s,\.]*[Tt]hank\s+you(\s+for\s+\w+)?[\.!,]?\s*$",
    r"[\s,\.]*[Mm]erci[\.!,]?\s*$",
    r"[\s,\.]*[Pp]lease\s+subscribe[\.!,]?\s*$",
    r"[\s,\.]*[Ss]ous-titres?.*$",
    r"[\s,\.]*\[.*?\]\s*$",
]


def _strip_hallucinated_suffix(text: str) -> str:
    for pattern in HALLUCINATION_SUFFIXES:
        text = re.sub(pattern, "", text, flags=re.IGNORECASE).strip()
    return text


def _empty_result(error: str, rms: float, raw_text: str = "", avg_conf: float = 0.0) -> Dict[str, Any]:
    return {
        "raw_text": raw_text, "clean_text": "", "fillers_found": [],
        "words": [], "language_prob": 0.0, "avg_confidence": avg_conf,
        "duration": 0.0, "is_silent": True, "rms_energy": round(rms, 5),
        "error": error,
    }


def transcribe_audio(
    audio: np.ndarray, sr: int, lang: str, whisper_model: WhisperModel,
    **_kwargs,
) -> Dict[str, Any]:
    silent, rms = is_silent_audio(audio, sr)
    if silent:
        return _empty_result("SILENT_AUDIO", rms)

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        sf.write(tmp.name, audio, sr)
        tmp_path = tmp.name

    # Generic domain prompt — helps Whisper stay in pronunciation context
    # without copying the expected phrase (which caused false all-green results)
    if lang == "fr":
        prompt = "Phrase de pratique de prononciation francaise."
    else:
        prompt = "English pronunciation practice sentence."

    try:
        segs, info = whisper_model.transcribe(
            tmp_path,
            language=lang,
            beam_size=1,   # greedy — 2× faster on CPU, sufficient for pronunciation scoring
            best_of=1,
            temperature=0.0,
            vad_filter=False,
            word_timestamps=True,
            condition_on_previous_text=False,
            no_speech_threshold=0.45,
            log_prob_threshold=-1.0,
            compression_ratio_threshold=2.4,
            initial_prompt=prompt,
        )
        raw_segs = list(segs)
        if not raw_segs:
            return _empty_result("NO_SPEECH_DETECTED", rms)
        valid = [s for s in raw_segs if getattr(s, "no_speech_prob", 0) < 0.7]
        if not valid:
            return _empty_result("NO_SPEECH_DETECTED", rms)
        raw_text = " ".join(s.text.strip() for s in valid).strip()
        raw_text = _strip_hallucinated_suffix(raw_text)
        if _is_hallucination(raw_text):
            return _empty_result("HALLUCINATION_DETECTED", rms, raw_text)
        words = []
        for seg in valid:
            if hasattr(seg, "words") and seg.words:
                for w in seg.words:
                    words.append({
                        "word": w.word.strip(),
                        "start": float(w.start),
                        "end": float(w.end),
                        "probability": float(round(w.probability, 3)),
                    })
        avg_conf = sum(w["probability"] for w in words) / len(words) if words else 0.0
        if avg_conf < LOW_CONFIDENCE_THRESHOLD and len(words) <= LOW_CONF_MAX_WORDS:
            return _empty_result("LOW_CONFIDENCE", rms, raw_text, avg_conf)
        clean, fillers = remove_filler_words(raw_text, lang)
        return {
            "raw_text": raw_text,
            "clean_text": clean,
            "fillers_found": fillers,
            "words": words,
            "language_prob": round(info.language_probability, 3),
            "avg_confidence": round(avg_conf, 3),
            "duration": round(info.duration, 2),
            "is_silent": False,
            "rms_energy": round(rms, 5),
            "error": None,
        }
    finally:
        os.unlink(tmp_path)


# ══════════════════════════════════════════════════════════════════════════════
# Text utilities
# ══════════════════════════════════════════════════════════════════════════════

def normalize_text(s: str) -> str:
    s = (s or "").lower().strip()
    # Strip accents: gâché→gache, forêt→foret, so Whisper typos don't kill the score
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"[^\w\s']", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def remove_filler_words(text: str, lang: str) -> Tuple[str, List[str]]:
    fillers = FILLER_WORDS.get(lang, FILLER_WORDS["en"])
    found, cleaned = [], []
    for w in text.split():
        wl = w.lower().strip(".,!?;:")
        if wl in fillers:
            found.append(wl)
        else:
            cleaned.append(w)
    return " ".join(cleaned).strip(), found


# ══════════════════════════════════════════════════════════════════════════════
# Word diff — weighted scoring with FUNCTION_WORDS
# ══════════════════════════════════════════════════════════════════════════════

def word_diff(expected: str, got: str, lang: str = "fr") -> Dict[str, Any]:
    """
    Compute word-level diff between expected and got transcription.
    Uses weighted scoring: function words count less than content words.
    Returns ops list plus WER, weighted score, precision, recall, F1.
    """
    exp = normalize_text(expected).split()
    hyp = normalize_text(got).split()
    n, m = len(exp), len(hyp)

    # Build edit-distance DP table
    dp = [[0] * (m + 1) for _ in range(n + 1)]
    bt = [[None] * (m + 1) for _ in range(n + 1)]
    for i in range(n + 1):
        dp[i][0] = i
        if i > 0:
            bt[i][0] = ("DEL", i - 1, 0)
    for j in range(m + 1):
        dp[0][j] = j
        if j > 0:
            bt[0][j] = ("INS", 0, j - 1)
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            cost = 0 if exp[i - 1] == hyp[j - 1] else 1
            choices = [
                (dp[i - 1][j] + 1,    ("DEL",                  i - 1, j    )),
                (dp[i][j - 1] + 1,    ("INS",                  i,     j - 1)),
                (dp[i - 1][j - 1] + cost, ("MATCH" if cost == 0 else "SUB", i - 1, j - 1)),
            ]
            dp[i][j], bt[i][j] = min(choices, key=lambda x: x[0])

    # Traceback
    ops, i, j = [], n, m
    while i > 0 or j > 0:
        st = bt[i][j]
        if st is None:
            break
        op, ei, hj = st
        if op in ("MATCH", "SUB"):
            ops.append({"op": op, "expected": exp[ei], "got": hyp[hj]})
            i -= 1; j -= 1
        elif op == "DEL":
            ops.append({"op": "DEL", "expected": exp[ei], "got": None})
            i -= 1
        else:
            ops.append({"op": "INS", "expected": None, "got": hyp[hj]})
            j -= 1
    ops.reverse()

    # Raw WER (unweighted, for reference)
    raw_wer = (
        jiwer_wer(normalize_text(expected), normalize_text(got))
        if expected.strip()
        else 1.0
    )

    # Weighted scoring
    total_weight  = sum(get_word_weight(w, lang) for w in exp) if exp else 1.0
    match_weight  = sum(
        get_word_weight(o["expected"], lang)
        for o in ops
        if o["op"] == "MATCH"
    )
    weighted_score = int(round(100 * match_weight / max(total_weight, 1e-9)))
    weighted_score = max(0, min(100, weighted_score))

    # Classic counts (for display / F1)
    n_match = sum(1 for o in ops if o["op"] == "MATCH")
    n_sub   = sum(1 for o in ops if o["op"] == "SUB")
    n_del   = sum(1 for o in ops if o["op"] == "DEL")
    n_ins   = sum(1 for o in ops if o["op"] == "INS")
    prec    = n_match / max(len(hyp), 1)
    rec     = n_match / max(len(exp), 1)
    f1      = (2 * prec * rec / (prec + rec)) if (prec + rec) > 0 else 0.0

    return {
        "ops":               ops,
        "wer":               float(raw_wer),
        "score":             weighted_score,
        "n_match":           n_match,
        "n_sub":             n_sub,
        "n_del":             n_del,
        "n_ins":             n_ins,
        "precision":         float(round(prec * 100, 1)),
        "recall":            float(round(rec  * 100, 1)),
        "f1":                float(round(f1   * 100, 1)),
        "n_words_expected":  len(exp),
        "n_words_got":       len(hyp),
    }


# ══════════════════════════════════════════════════════════════════════════════
# Score message helper
# ══════════════════════════════════════════════════════════════════════════════

def score_message(score: int, lang: str) -> str:
    fr = [
        (90, "Excellent ! Prononciation quasi-parfaite."),
        (80, "Tres bien !"),
        (65, "Bien ! Continue."),
        (50, "Passable."),
        (0,  "A retravailler."),
    ]
    en = [
        (90, "Excellent! Near-perfect."),
        (80, "Very good!"),
        (65, "Good! Keep going."),
        (50, "Fair. Focus on errors."),
        (0,  "Needs work."),
    ]
    msgs = fr if lang == "fr" else en
    for threshold, msg in msgs:
        if score >= threshold:
            return msg
    return msgs[-1][1]
