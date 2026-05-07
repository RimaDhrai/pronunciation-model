package com.example.prononciationtest.entity;


import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(name = "cefr_sessions")
@Data
public class CEFRSession {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "session_id", unique = true, nullable = false)
    private String sessionId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "lang", length = 5)
    private String lang;

    @Column(name = "status", length = 20)
    private String status = "IN_PROGRESS";

    @Column(name = "final_level", length = 5)
    private String finalLevel;

    @Column(name = "avg_score")
    private Integer avgScore;

    @Column(name = "started_at")
    private LocalDateTime startedAt = LocalDateTime.now();

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    public Integer getAvgScore() { return avgScore; }
    public void setAvgScore(Integer avgScore) { this.avgScore = avgScore; }
}
