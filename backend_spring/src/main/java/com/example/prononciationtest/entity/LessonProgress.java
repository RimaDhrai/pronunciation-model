package com.example.prononciationtest.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

/**
 * Suivi de complétion par leçon (une ligne = une leçon validée par un utilisateur).
 * Utilisé par :
 *   PUT  /api/courses/{courseId}/lessons/{lessonId}/complete
 *   GET  /api/courses/{courseId}/lesson-progress
 */
@Entity
@Table(
    name = "lesson_progress",
    uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "lesson_id"})
)
@Data
public class LessonProgress {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "lesson_id", nullable = false)
    private Long lessonId;

    @Column(name = "course_id", nullable = false)
    private Long courseId;

    @Column(name = "completed", nullable = false)
    private boolean completed = true;

    @Column(name = "completed_at")
    private LocalDateTime completedAt = LocalDateTime.now();
}
