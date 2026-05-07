package com.example.prononciationtest.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.Instant;

@Entity
@Table(name = "users")
@Getter
@Setter

public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @JsonProperty("createdAt")
    private Instant createdAt;

    private String fullName;

    private boolean enabled = true;

    @Column(name = "cefr_level", length = 5)
    private String cefrLevel;

    @Column(name = "cefr_level_en", length = 5)
    private String cefrLevelEn;

    @Column(name = "cefr_completed", columnDefinition = "boolean DEFAULT false")
    private Boolean cefrCompleted = false;

    @Column(name = "cefr_completed_en", columnDefinition = "boolean DEFAULT false")
    private Boolean cefrCompletedEn = false;

    @Column(name = "job_title", length = 100)
    private String jobTitle;

    @Column(name = "native_lang", length = 10)
    private String nativeLang = "fr";

    @Column(name = "total_xp")
    private Integer totalXp = 0;

    @Column(name = "current_streak")
    private Integer currentStreak = 0;

    @Column(name = "longest_streak")
    private Integer longestStreak = 0;

    @Column(name = "last_activity_date")
    private java.time.LocalDate lastActivityDate;

    /** Mots mal prononcés en exercice — stockés séparés par virgule, max 500 chars */
    @Column(name = "weak_words", length = 500)
    private String weakWords;

}
