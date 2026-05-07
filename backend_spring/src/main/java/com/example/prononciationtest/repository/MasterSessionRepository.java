package com.example.prononciationtest.repository;

import com.example.prononciationtest.entity.MasterSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.Optional;

@Repository
public interface MasterSessionRepository extends JpaRepository<MasterSession, Long> {

    Optional<MasterSession> findBySessionId(String sessionId);

    @Modifying
    @Transactional
    @Query("DELETE FROM MasterSession ms WHERE ms.createdAt < :cutoff")
    void deleteExpiredBefore(LocalDateTime cutoff);
}
