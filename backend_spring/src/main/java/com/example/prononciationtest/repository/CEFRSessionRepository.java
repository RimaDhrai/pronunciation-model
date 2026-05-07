package com.example.prononciationtest.repository;



import com.example.prononciationtest.entity.CEFRSession;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.List;
public interface CEFRSessionRepository extends JpaRepository<CEFRSession, Long>  {

    Optional<CEFRSession> findBySessionId(String sessionId);
    List<CEFRSession> findByUserIdOrderByStartedAtDesc(Long userId);
    long countByStatus(String status);
    long countByUserIdAndStatus(Long userId, String status);
    boolean existsByUserIdAndStatus(Long userId, String status);
}
