package com.example.prononciationtest.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;


@Entity
@Table(name = "attempts")
public class Attempt {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    // ── Champs principaux ─────────────────────────────────────────────────

    @Column(nullable = false, length = 500)
    private String expectedPhrase;

    @Column(length = 500)
    private String transcription;

    @Column(nullable = false)
    private int score;

    @Column
    private double wer;

    @Column(length = 10)
    private String language;

    @Column(length = 5)
    private String level;

    @Column(columnDefinition = "TEXT")
    private String feedback;

    @Column
    private String audioPath;          // chemin fichier audio (optionnel)

    @Column(nullable = false)
    private LocalDateTime createdAt;

    // ══════════════════════════════════════════════════════════════════════
    // GETTERS
    // ══════════════════════════════════════════════════════════════════════

    public Long getId()                { return id; }
    public User getUser()              { return user; }
    public String getExpectedPhrase()  { return expectedPhrase; }
    public String getTranscription()   { return transcription; }
    public int getScore()              { return score; }
    public double getWer()             { return wer; }
    public String getLanguage()        { return language; }
    public String getLevel()           { return level; }
    public String getFeedback()        { return feedback; }
    public String getAudioPath()       { return audioPath; }
    public LocalDateTime getCreatedAt(){ return createdAt; }

    // ══════════════════════════════════════════════════════════════════════
    // SETTERS — noms NOUVEAUX (utilisés par PracticeService)
    // ══════════════════════════════════════════════════════════════════════

    public void setId(Long id)                      { this.id = id; }
    public void setUser(User user)                  { this.user = user; }
    public void setExpectedPhrase(String s)         { this.expectedPhrase = s; }
    public void setTranscription(String s)          { this.transcription = s; }
    public void setScore(int score)                 { this.score = score; }
    public void setWer(double wer)                  { this.wer = wer; }
    public void setLanguage(String language)        { this.language = language; }
    public void setLevel(String level)              { this.level = level; }
    public void setFeedback(String feedback)        { this.feedback = feedback; }
    public void setAudioPath(String audioPath)      { this.audioPath = audioPath; }
    public void setCreatedAt(LocalDateTime t)       { this.createdAt = t; }
}


