package com.example.prononciationtest.service.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;
import java.util.Map;

@JsonIgnoreProperties(ignoreUnknown = true)
public class SttResponse {

    @JsonProperty("raw_text")
    private String rawText;

    @JsonProperty("clean_text")
    private String cleanText;

    @JsonProperty("fillers_found")
    private List<String> fillersFound;

    @JsonProperty("words")
    private List<Map<String, Object>> words;

    @JsonProperty("avg_confidence")
    private double avgConfidence;

    @JsonProperty("language_prob")
    private double languageProb;

    @JsonProperty("duration")
    private double duration;

    @JsonProperty("is_silent")
    private boolean isSilent;

    @JsonProperty("rms_energy")
    private double rmsEnergy;

    @JsonProperty("error")
    private String error;

    // ── Getters ───────────────────────────────────────────────────────────

    public String getRawText()                       { return rawText; }
    public String getCleanText()                     { return cleanText; }
    public List<String> getFillersFound()            { return fillersFound; }
    public List<Map<String, Object>> getWords()      { return words; }
    public double getAvgConfidence()                 { return avgConfidence; }
    public double getLanguageProb()                  { return languageProb; }
    public double getDuration()                      { return duration; }
    public boolean isSilent()                        { return isSilent; }
    public double getRmsEnergy()                     { return rmsEnergy; }
    public String getError()                         { return error; }

    public String getTranscription()                 { return cleanText; }

    // ── Setters ───────────────────────────────────────────────────────────

    public void setRawText(String v)                 { this.rawText = v; }
    public void setCleanText(String v)               { this.cleanText = v; }
    public void setFillersFound(List<String> v)      { this.fillersFound = v; }
    public void setWords(List<Map<String, Object>> v){ this.words = v; }
    public void setAvgConfidence(double v)           { this.avgConfidence = v; }
    public void setLanguageProb(double v)            { this.languageProb = v; }
    public void setDuration(double v)                { this.duration = v; }
    public void setSilent(boolean v)                 { this.isSilent = v; }
    public void setRmsEnergy(double v)               { this.rmsEnergy = v; }
    public void setError(String v)                   { this.error = v; }

    // ── Utilitaire ────────────────────────────────────────────────────────

    public boolean isValid() {
        return !isSilent
                && error == null
                && cleanText != null
                && !cleanText.isBlank();
    }
}