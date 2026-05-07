package com.example.prononciationtest.service.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;

import java.util.List;
import java.util.Map;

@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
public class PythonAnalyzeResponse {

    private String transcript;

    @JsonProperty("raw_transcript")
    private String rawTranscript;

    @JsonProperty("clean_transcript")
    private String cleanTranscript;

    private Double wer;
    private Double f1;
    private Double precision;
    private Double recall;

    /** Weighted match score from word_diff (0-100). Used by Spring to compute final score. */
    @JsonProperty("word_diff_score")
    private Integer wordDiffScore;

    @JsonProperty("avg_confidence")
    private Double avgConfidence;

    @JsonProperty("fillers_found")
    private List<String> fillersFound;

    private List<Op> ops;

    @JsonProperty("n_match")
    private Integer nMatch;

    @JsonProperty("n_sub")
    private Integer nSub;

    @JsonProperty("n_del")
    private Integer nDel;

    @JsonProperty("n_ins")
    private Integer nIns;

    /** Word-level confidence data — used to compute phonetic penalty in Spring. */
    private List<Map<String, Object>> words;

    @JsonProperty("language_prob")
    private Double languageProb;

    private Double duration;

    @JsonProperty("rms_energy")
    private Double rmsEnergy;

    @JsonProperty("stt_error")
    private Boolean sttError;

    @JsonProperty("stt_error_code")
    private String sttErrorCode;

    @JsonProperty("stt_error_message")
    private String sttErrorMessage;

    public boolean hasSttError() {
        return Boolean.TRUE.equals(sttError);
    }

    @Getter
    @Setter
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Op {
        private String op;
        private String expected;
        private String got;
    }
}
