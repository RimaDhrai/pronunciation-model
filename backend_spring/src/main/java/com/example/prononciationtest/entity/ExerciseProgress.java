package com.example.prononciationtest.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;

@Entity
@Table(
    name = "exercise_progress",
    uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "level"})
)
@Getter
@Setter
public class ExerciseProgress {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false, length = 5)
    private String level;           // A1, A2, B1, B2, C1, C2

    @Column(nullable = false)
    private boolean done = false;   // session complète (toutes les phrases faites)

    @Column(nullable = false)
    private boolean mastered = false; // score moyen >= 60

    @Column(name = "last_avg_score")
    private Integer lastAvgScore;

    @Column(nullable = false)
    private int completed = 0;      // nombre de phrases complétées

    @Column(name = "sessions_count", nullable = false)
    private int sessionsCount = 0;  // nombre de sessions jouées

    @Column(name = "updated_at")
    private LocalDateTime updatedAt = LocalDateTime.now();
}
