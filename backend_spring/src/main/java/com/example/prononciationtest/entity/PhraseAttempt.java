package com.example.prononciationtest.entity;



import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(name = "phrase_attempts")
@Data
public class PhraseAttempt {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "session_id", nullable = false)
    private String sessionId;

    @Column(name = "phrase", columnDefinition = "TEXT")
    private String phrase;

    @Column(name = "level_tested", length = 5)
    private String levelTested;

    @Column(name = "score")
    private Integer score;

    @Column(name = "wer")
    private Double wer;

    @Column(name = "f1")
    private Double f1;

    @Column(name = "stt_clean", columnDefinition = "TEXT")
    private String sttClean;

    @Column(name = "phase", length = 20)
    private String phase;

    @Column(name = "attempt_at")
    private LocalDateTime attemptAt = LocalDateTime.now();
}
