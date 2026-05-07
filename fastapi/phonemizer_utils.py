# phonemizer_utils.py — G2P (Graphème → Phonème) pour FR et EN
# Utilise phonemizer+espeak-ng si disponible, sinon dictionnaire intégré.
from __future__ import annotations
import logging
import re
from typing import Optional

logger = logging.getLogger("SpeakCoach.Phonemizer")

# ── Tentative de chargement de phonemizer ────────────────────────────────────
_phonemizer_available = False
try:
    from phonemizer import phonemize as _phonemize
    from phonemizer.backend import EspeakBackend
    
    import os
    if os.name == 'nt':
        default_path = r"C:\Program Files\eSpeak NG\libespeak-ng.dll"
        if os.path.exists(default_path):
            EspeakBackend.set_library(default_path)
        else:
            EspeakBackend.set_library(None)
    else:
        EspeakBackend.set_library(None)
        
    _phonemizer_available = True
    logger.info("[G2P] phonemizer+espeak-ng disponible")
except Exception as _e:
    logger.warning(f"[G2P] phonemizer indisponible ({_e}) — fallback dictionnaire activé")


# ── Dictionnaires de fallback (mots-clés phonétiques FR/EN) ─────────────────
_PHONEME_DICT_FR: dict[str, str] = {
    # Sons nasaux
    "main": "mɛ̃", "vin": "vɛ̃", "pain": "pɛ̃", "lapin": "lapɛ̃", "matin": "matɛ̃",
    "bon": "bɔ̃", "pont": "pɔ̃", "balcon": "balkɔ̃", "mouton": "mutɔ̃",
    "grand": "ɡʁɑ̃", "enfant": "ɑ̃fɑ̃", "temps": "tɑ̃", "vent": "vɑ̃",
    # R grasseyé
    "rouge": "ʁuʒ", "renard": "ʁənaʁ", "bruit": "bʁɥi", "paris": "paʁi",
    "partir": "paʁtiʁ", "crier": "kʁije", "brosse": "bʁɔs",
    # U français
    "rue": "ʁy", "lune": "lyn", "bureau": "byʁo", "futur": "fytyʁ",
    # EU
    "deux": "dø", "feu": "fø", "heureux": "øʁø", "beurre": "bœʁ",
    "sœur": "sœʁ", "bleu": "blø",
    # GN
    "montagne": "mɔ̃taɲ", "vigne": "viɲ", "gagner": "ɡaɲe", "signe": "siɲ",
    # CH / J
    "chat": "ʃa", "chose": "ʃoz", "chocolat": "ʃɔkɔla",
    "je": "ʒə", "jour": "ʒuʁ", "jardin": "ʒaʁdɛ̃",
    # Liaisons
    "les": "le", "vous": "vu", "ils": "il", "un": "ɛ̃", "en": "ɑ̃",
}

_PHONEME_DICT_EN: dict[str, str] = {
    # TH
    "think": "θɪŋk", "the": "ðə", "three": "θriː", "that": "ðæt",
    "both": "boʊθ", "through": "θruː", "weather": "ˈwɛðər", "brother": "ˈbrʌðər",
    # R
    "river": "ˈrɪvər", "road": "roʊd", "rain": "reɪn", "run": "rʌn",
    "arrive": "əˈraɪv", "worry": "ˈwʌri",
    # Flat A
    "cat": "kæt", "hat": "hæt", "bag": "bæɡ", "man": "mæn", "black": "blæk",
    # Short I
    "sit": "sɪt", "him": "hɪm", "big": "bɪɡ", "fish": "fɪʃ", "ring": "rɪŋ",
    # NG
    "running": "ˈrʌnɪŋ", "singing": "ˈsɪŋɪŋ", "king": "kɪŋ", "thing": "θɪŋ",
    # W
    "water": "ˈwɔːtər", "walk": "wɔːk", "wind": "wɪnd", "world": "wɜːrld",
    # V
    "voice": "vɔɪs", "very": "ˈvɛri", "five": "faɪv", "love": "lʌv",
    # Schwa
    "about": "əˈbaʊt", "teacher": "ˈtiːtʃər", "doctor": "ˈdɒktər",
    "problem": "ˈprɒbləm", "system": "ˈsɪstəm",
    # Diphthongs
    "day": "deɪ", "time": "taɪm", "boy": "bɔɪ", "go": "ɡoʊ", "now": "naʊ",
    # Dark L
    "ball": "bɔːl", "full": "fʊl", "milk": "mɪlk", "fall": "fɔːl",
}


def get_phonemes(text: str, lang: str = "fr") -> dict:
    """
    Retourne la transcription phonétique IPA d'une phrase.

    Returns:
        {
          "text": str,
          "ipa": str,           # transcription IPA complète
          "words": [{"word": str, "ipa": str}],
          "source": "phonemizer" | "dict" | "unavailable"
        }
    """
    words = re.findall(r"\b\w+\b", text.lower())

    if _phonemizer_available:
        try:
            backend_lang = "fr-fr" if lang == "fr" else "en-us"
            ipa = _phonemize(
                text,
                backend="espeak",
                language=backend_lang,
                with_stress=True,
                njobs=1,
            ).strip()

            word_ipas = _phonemize(
                words,
                backend="espeak",
                language=backend_lang,
                with_stress=True,
                njobs=1,
            )
            if isinstance(word_ipas, list):
                pairs = [{"word": w, "ipa": p.strip()} for w, p in zip(words, word_ipas)]
            else:
                pairs = [{"word": w, "ipa": ""} for w in words]

            return {"text": text, "ipa": ipa, "words": pairs, "source": "phonemizer"}
        except Exception as exc:
            logger.warning(f"[G2P] phonemize() échoué: {exc}")

    # Fallback dictionnaire
    d = _PHONEME_DICT_FR if lang == "fr" else _PHONEME_DICT_EN
    pairs = [{"word": w, "ipa": d.get(w, "")} for w in words]
    full_ipa = " ".join(p["ipa"] or p["word"] for p in pairs)

    return {"text": text, "ipa": full_ipa, "words": pairs, "source": "dict"}


def compare_phonemes(expected_ipa: str, word_confidences: list[dict],
                     word_ipa_pairs: list[dict], lang: str = "fr") -> list[dict]:
    """
    Compare les phonèmes attendus avec la confiance Whisper mot par mot.
    Identifie les phonèmes susceptibles d'être mal prononcés.

    Returns: liste de dicts {word, ipa, confidence, issue}
    """
    results = []
    ipa_map = {p["word"].lower(): p["ipa"] for p in word_ipa_pairs}

    for wc in word_confidences:
        word  = wc.get("word", "").strip(".,!?").lower()
        conf  = wc.get("probability", 1.0)
        ipa   = ipa_map.get(word, "")
        issue = conf < 0.50 and bool(ipa)

        results.append({
            "word":       word,
            "ipa":        ipa,
            "confidence": float(round(conf, 3)),
            "issue":      bool(issue),
        })

    return results
