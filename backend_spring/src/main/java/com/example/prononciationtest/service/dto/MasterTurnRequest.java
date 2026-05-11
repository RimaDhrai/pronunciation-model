package com.example.prononciationtest.service.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

import java.util.List;

public class MasterTurnRequest {

    @NotBlank(message = "sessionId est requis")
    @JsonAlias("session_id")
    public String sessionId;

    /** CHAT | TEST | TEST_FINISH | EXERCISE */
    @Pattern(regexp = "^(CHAT|TEST|TEST_FINISH|EXERCISE)$",
             message = "mode doit être CHAT, TEST, TEST_FINISH ou EXERCISE")
    public String mode = "CHAT";

    @Pattern(regexp = "^(fr|en)$", message = "lang doit être 'fr' ou 'en'")
    public String lang = "fr";

    /** User text (CHAT mode) or empty string */
    public String input = "";

    @JsonAlias("weak_words")
    public List<String> weakWords;

    @JsonAlias("pron_score")
    public Double pronScore;

    /** Optional roleplay scenario (CHAT mode) */
    public String scenario = "";

    /**
     * For TEST/next: pronunciation score 0-100 for the phrase that was spoken.
     * For EXERCISE: pronunciation score 0-100 for the previous phrase.
     */
    @JsonAlias("score_input")
    public Integer scoreInput;

    /** For TEST/next: the phrase that was pronounced (returned by the previous step). */
    public String phrase;

    /**
     * Phoneme-level errors from FastAPI /analyze (e.g. ["r", "u", "nasal"]).
     * Forwarded to SessionMemoryService.addWeakWords() for cross-mode tracking.
     */
    @JsonAlias("phoneme_errors")
    public List<String> phonemeErrors;
}
