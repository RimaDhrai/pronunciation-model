package com.example.prononciationtest.repository;

import com.example.prononciationtest.entity.ExerciseProgress;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ExerciseProgressRepository extends JpaRepository<ExerciseProgress, Long> {

    List<ExerciseProgress> findByUserId(Long userId);

    List<ExerciseProgress> findByUserIdAndLang(Long userId, String lang);

    Optional<ExerciseProgress> findByUserIdAndLevelAndLang(Long userId, String level, String lang);

    boolean existsByUserIdAndLevelAndLangAndDoneTrue(Long userId, String level, String lang);
}
