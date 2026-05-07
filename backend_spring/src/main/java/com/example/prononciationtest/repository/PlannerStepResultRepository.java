package com.example.prononciationtest.repository;

import com.example.prononciationtest.entity.PlannerStepResult;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface PlannerStepResultRepository extends JpaRepository<PlannerStepResult, Long> {

    List<PlannerStepResult> findBySessionIdOrderByStepNumber(String sessionId);
    List<PlannerStepResult> findByUserId(Long userId);
}
