package com.example.prononciationtest.service.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.List;

/**
 * Réponse de FastAPI → POST /api/chat/stt
 * STT uniquement — le LLM est géré par Spring Boot.
 */
@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class ChatSttResponse {

    /** Texte transcrit par Whisper (nettoyé). */
    @JsonProperty("clean_text")
    private String cleanText;

    /** Mots avec confiance Whisper < 0.40 → à signaler au LLM pour correction. */
    @JsonProperty("weak_words")
    private List<String> weakWords;

    @JsonProperty("avg_confidence")
    private Double avgConfidence;

    /** Score de prononciation 0-100 (avg_confidence × 100). */
    @JsonProperty("pron_score")
    private Integer pronScore;

    /** Label qualitatif : excellent / good / fair / needs_work. */
    @JsonProperty("pron_feedback")
    private String pronFeedback;

    /** Non-null si erreur STT (audio silencieux, faible confiance, etc.). */
    private String error;

    /** true si le client doit réessayer (audio trop court, silence, etc.). */
    private Boolean retry;

    public boolean hasError() {
        return error != null;
    }
}
