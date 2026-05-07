// UserCourseProgressRepository.java
package com.example.prononciationtest.repository;

import com.example.prononciationtest.entity.UserCourseProgress;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface UserCourseProgressRepository extends JpaRepository<UserCourseProgress, Long> {

    List<UserCourseProgress> findByUserId(Long userId);

    Optional<UserCourseProgress> findByUserIdAndCourseId(Long userId, Long courseId);

    List<UserCourseProgress> findByUserIdAndStatus(Long userId, String status);
}