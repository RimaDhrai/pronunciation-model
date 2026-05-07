// CourseRepository.java
package com.example.prononciationtest.repository;

import com.example.prononciationtest.entity.Course;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface CourseRepository extends JpaRepository<Course, Long> {

    // Tous les cours d'un niveau CEFR
    List<Course> findByCefrLevelAndActiveTrue(String cefrLevel);

    // Tous les cours d'une langue
    List<Course> findByLangAndActiveTrue(String lang);

    // Cours par niveau ET langue — pour les recommandations
    List<Course> findByCefrLevelAndLangAndActiveTrueOrderByDisplayOrderAsc(
            String cefrLevel, String lang
    );

    // Cours par catégorie
    List<Course> findByCategoryAndActiveTrueOrderByDisplayOrderAsc(String category);
}