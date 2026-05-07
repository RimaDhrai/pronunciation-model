package com.example.prononciationtest.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;

@Entity
@Table(name = "master_sessions")
@Getter @Setter
public class MasterSession {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "session_id", unique = true, nullable = false, length = 100)
    private String sessionId;

    @Column(name = "user_email", length = 200)
    private String userEmail;

    @Column(name = "lang", length = 5)
    private String lang = "fr";

    @Column(name = "cefr_level", length = 5)
    private String cefrLevel = "B1";

    @Column(name = "total_xp")
    private int totalXp = 0;

    @Column(name = "exercise_round")
    private int exerciseRound = 0;

    @Column(name = "chat_round")
    private int chatRound = 0;

    @Column(name = "test_session_id", length = 100)
    private String testSessionId;

    // JSON array of weak words — e.g. ["rouge","leur","grenouille"]
    @Column(name = "error_log", columnDefinition = "TEXT")
    private String errorLogJson = "[]";

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    private LocalDateTime updatedAt = LocalDateTime.now();
}
