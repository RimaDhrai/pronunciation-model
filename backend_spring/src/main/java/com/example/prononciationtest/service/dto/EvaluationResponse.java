package com.example.prononciationtest.service.dto;

import java.util.List;
import java.util.Map;

/**
 * Réponse complète envoyée à React après analyse d'une tentative.
 */
public class EvaluationResponse {

    // ── Transcription ─────────────────────────────────────────────────────
    private String expectedPhrase;
    private String rawTranscription;
    private String cleanTranscription;
    private List<String> fillersFound;

    // ── Scores ────────────────────────────────────────────────────────────
    private int score;            // 0-100 composite
    private int cefrScore;        // score normalisé par niveau − pénalité phonétique
    private int xpEarned;
    private String scoreLabel;
    private int phoneticPenalty;
    private double wer;           // Word Error Rate
    private double f1;            // F1-score (%)
    private double precision;
    private double recall;
    private double avgConfidence; // Confiance Whisper

    // ── Diff mot-à-mot ────────────────────────────────────────────────────
    private List<Map<String, Object>> diffOps;  // [{op, expected, got}]
    private int nMatch;
    private int nSub;
    private int nDel;
    private int nIns;

    // ── LLM Feedback ─────────────────────────────────────────────────────
    private String feedback;      // Généré par Ollama via OllamaService

    // ── Erreur STT ────────────────────────────────────────────────────────
    private boolean sttError;
    private String sttErrorCode;  // SILENT_AUDIO, NO_SPEECH_DETECTED, etc.
    private String sttErrorMessage;

    // ── Constructeur statique pour erreur STT ─────────────────────────────
    public static EvaluationResponse fromSttError(SttResponse stt) {
        EvaluationResponse r = new EvaluationResponse();
        r.sttError = true;
        r.sttErrorCode = stt.getError();
        r.sttErrorMessage = switch (stt.getError()) {
            case "SILENT_AUDIO"          -> "Audio trop silencieux, parle plus fort.";
            case "NO_SPEECH_DETECTED"    -> "Aucune parole détectée.";
            case "HALLUCINATION_DETECTED"-> "Transcription invalide, réessaie.";
            case "LOW_CONFIDENCE"        -> "Confiance trop faible, parle plus clairement.";
            default                      -> "Erreur de transcription inconnue.";
        };
        return r;
    }

    // ── Getters & Setters ─────────────────────────────────────────────────

    public String getExpectedPhrase() { return expectedPhrase; }
    public void setExpectedPhrase(String expectedPhrase) { this.expectedPhrase = expectedPhrase; }

    public String getRawTranscription() { return rawTranscription; }
    public void setRawTranscription(String rawTranscription) { this.rawTranscription = rawTranscription; }

    public String getCleanTranscription() { return cleanTranscription; }
    public void setCleanTranscription(String cleanTranscription) { this.cleanTranscription = cleanTranscription; }

    public List<String> getFillersFound() { return fillersFound; }
    public void setFillersFound(List<String> fillersFound) { this.fillersFound = fillersFound; }

    public int getScore() { return score; }
    public void setScore(int score) { this.score = score; }

    public int getCefrScore() { return cefrScore; }
    public void setCefrScore(int cefrScore) { this.cefrScore = cefrScore; }

    public int getXpEarned() { return xpEarned; }
    public void setXpEarned(int xpEarned) { this.xpEarned = xpEarned; }

    public String getScoreLabel() { return scoreLabel; }
    public void setScoreLabel(String scoreLabel) { this.scoreLabel = scoreLabel; }

    public int getPhoneticPenalty() { return phoneticPenalty; }
    public void setPhoneticPenalty(int phoneticPenalty) { this.phoneticPenalty = phoneticPenalty; }

    public double getWer() { return wer; }
    public void setWer(double wer) { this.wer = wer; }

    public double getF1() { return f1; }
    public void setF1(double f1) { this.f1 = f1; }

    public double getPrecision() { return precision; }
    public void setPrecision(double precision) { this.precision = precision; }

    public double getRecall() { return recall; }
    public void setRecall(double recall) { this.recall = recall; }

    public double getAvgConfidence() { return avgConfidence; }
    public void setAvgConfidence(double avgConfidence) { this.avgConfidence = avgConfidence; }

    public List<Map<String, Object>> getDiffOps() { return diffOps; }
    public void setDiffOps(List<Map<String, Object>> diffOps) { this.diffOps = diffOps; }

    public int getNMatch() { return nMatch; }
    public void setNMatch(int nMatch) { this.nMatch = nMatch; }

    public int getNSub() { return nSub; }
    public void setNSub(int nSub) { this.nSub = nSub; }

    public int getNDel() { return nDel; }
    public void setNDel(int nDel) { this.nDel = nDel; }

    public int getNIns() { return nIns; }
    public void setNIns(int nIns) { this.nIns = nIns; }

    public String getFeedback() { return feedback; }
    public void setFeedback(String feedback) { this.feedback = feedback; }

    public boolean isSttError() { return sttError; }
    public void setSttError(boolean sttError) { this.sttError = sttError; }

    public String getSttErrorCode() { return sttErrorCode; }
    public void setSttErrorCode(String sttErrorCode) { this.sttErrorCode = sttErrorCode; }

    public String getSttErrorMessage() { return sttErrorMessage; }
    public void setSttErrorMessage(String sttErrorMessage) { this.sttErrorMessage = sttErrorMessage; }
}