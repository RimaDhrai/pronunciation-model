package com.example.prononciationtest.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(name = "planner_step_results")
@Data
public class PlannerStepResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "session_id", nullable = false)
    private String sessionId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "step_number")
    private Integer stepNumber;

    @Column(name = "target_sound", length = 50)
    private String targetSound;

    @Column(name = "phrase", columnDefinition = "TEXT")
    private String phrase;

    @Column(name = "score")
    private Integer score;

    @Column(name = "progressed")
    private Boolean progressed;

    @Column(name = "lang", length = 5)
    private String lang;

    @Column(name = "level", length = 5)
    private String level;

    @Column(name = "attempted_at")
    private LocalDateTime attemptedAt = LocalDateTime.now();
}
