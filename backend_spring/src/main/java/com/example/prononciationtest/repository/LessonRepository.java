// LessonRepository.java
package com.example.prononciationtest.repository;

import com.example.prononciationtest.entity.Lesson;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface LessonRepository extends JpaRepository<Lesson, Long> {
    List<Lesson> findByCourseIdAndActiveTrueOrderByLessonOrderAsc(Long courseId);
    List<Lesson> findByCourseId(Long courseId);
    long countByCourseIdAndActiveTrue(Long courseId);
}