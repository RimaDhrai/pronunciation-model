package com.example.prononciationtest.repository;

import com.example.prononciationtest.entity.Attempt;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AttemptRepository extends JpaRepository<Attempt, Long> {
    Page<Attempt> findByUserId(Long userId, Pageable pageable);
}