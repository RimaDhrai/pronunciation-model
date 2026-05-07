package com.example.prononciationtest.repository;

import com.example.prononciationtest.entity.Badge;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface BadgeRepository extends JpaRepository<Badge, Long> {
    List<Badge> findByUserId(Long userId);
    boolean existsByUserIdAndBadgeKey(Long userId, String badgeKey);
}
