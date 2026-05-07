package com.example.prononciationtest.repository;

import com.example.prononciationtest.entity.PhraseAttempt;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PhraseAttemptRepository extends JpaRepository<PhraseAttempt, Long> {
    List<PhraseAttempt> findBySessionIdOrderByAttemptAtAsc(String sessionId);
}
