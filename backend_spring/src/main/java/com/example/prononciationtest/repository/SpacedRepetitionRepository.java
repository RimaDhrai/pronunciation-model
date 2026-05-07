package com.example.prononciationtest.repository;

import com.example.prononciationtest.entity.SpacedRepetitionItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface SpacedRepetitionRepository extends JpaRepository<SpacedRepetitionItem, Long> {
    List<SpacedRepetitionItem> findByUserIdAndNextReviewLessThanEqual(Long userId, LocalDate date);
    List<SpacedRepetitionItem> findByUserIdAndItemTypeAndNextReviewLessThanEqual(Long userId, String itemType, LocalDate date);
    Optional<SpacedRepetitionItem> findByUserIdAndWordIgnoreCase(Long userId, String word);
    Optional<SpacedRepetitionItem> findByUserIdAndWordIgnoreCaseAndItemType(Long userId, String word, String itemType);
    long countByUserIdAndNextReviewLessThanEqual(Long userId, LocalDate date);
    long countByUserIdAndItemTypeAndNextReviewLessThanEqual(Long userId, String itemType, LocalDate date);

    @Modifying
    @Transactional
    @Query("UPDATE SpacedRepetitionItem i SET i.itemType = 'WORD' WHERE i.itemType IS NULL")
    void migrateNullItemTypes();
}
