package com.example.prononciationtest.repository;

import com.example.prononciationtest.entity.ExerciseProgress;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ExerciseProgressRepository extends JpaRepository<ExerciseProgress, Long> {

    List<ExerciseProgress> findByUserId(Long userId);

    Optional<ExerciseProgress> findByUserIdAndLevel(Long userId, String level);

    boolean existsByUserIdAndLevelAndDoneTrue(Long userId, String level);
}
