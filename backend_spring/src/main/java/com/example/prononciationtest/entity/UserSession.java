package com.example.prononciationtest.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "user_sessions")
public class UserSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(length = 50)
    private String type;       // "Diagnostic", "Karaoke", "Exercise"

    @Column(length = 500)
    private String phrase;

    @Column(nullable = false)
    private int score;

    @Column(length = 10)
    private String lang;

    @Column(length = 5)
    private String level;

    @Column(columnDefinition = "TEXT")
    private String feedback;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    // Getters
    public Long getId()               { return id; }
    public User getUser()             { return user; }
    public String getType()           { return type; }
    public String getPhrase()         { return phrase; }
    public int getScore()             { return score; }
    public String getLang()           { return lang; }
    public String getLevel()          { return level; }
    public String getFeedback()       { return feedback; }
    public LocalDateTime getCreatedAt(){ return createdAt; }

    // Setters
    public void setId(Long id)               { this.id = id; }
    public void setUser(User user)          { this.user = user; }
    public void setType(String type)        { this.type = type; }
    public void setPhrase(String phrase)    { this.phrase = phrase; }
    public void setScore(int score)         { this.score = score; }
    public void setLang(String lang)        { this.lang = lang; }
    public void setLevel(String level)      { this.level = level; }
    public void setFeedback(String feedback){ this.feedback = feedback; }
    public void setCreatedAt(LocalDateTime t){ this.createdAt = t; }
}
