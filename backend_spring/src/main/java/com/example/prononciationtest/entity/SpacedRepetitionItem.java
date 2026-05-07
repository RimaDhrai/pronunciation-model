package com.example.prononciationtest.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.ColumnDefault;
import java.time.LocalDate;

@Entity
@Table(name = "spaced_repetition_items")
@Getter @Setter
public class SpacedRepetitionItem {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    // For WORD type: the mispronounced word. For SOUND type: the sound key (e.g. "r", "eu")
    @Column(nullable = false, length = 100)
    private String word;

    @Column(length = 5)
    private String level; // CEFR level where this item appeared

    @Column(name = "error_count", nullable = false)
    private int errorCount = 1;

    @Column(name = "interval_days", nullable = false)
    private int intervalDays = 1; // progression: 1→3→7→14→30

    @Column(name = "next_review", nullable = false)
    private LocalDate nextReview;

    @Column(name = "last_seen", nullable = false)
    private LocalDate lastSeen;

    // "WORD" (from exercises/chatbot) or "SOUND" (from CEFR test — auto-enrolled)
    @ColumnDefault("'WORD'")
    @Column(name = "item_type", nullable = false, length = 10)
    private String itemType = "WORD";

    // Display label for SOUND items — e.g. "Le R grasseyé [ʁ]"
    @Column(name = "sound_label", length = 100)
    private String soundLabel;

    // Language for SOUND items — "fr" or "en"
    @Column(length = 5)
    private String lang;
}
