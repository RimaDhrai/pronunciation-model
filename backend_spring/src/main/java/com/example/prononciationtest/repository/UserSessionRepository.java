package com.example.prononciationtest.repository;

import com.example.prononciationtest.entity.UserSession;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface UserSessionRepository extends JpaRepository<UserSession, Long> {
    List<UserSession> findByUserIdOrderByCreatedAtDesc(Long userId);
    long countByUserId(Long userId);
}
