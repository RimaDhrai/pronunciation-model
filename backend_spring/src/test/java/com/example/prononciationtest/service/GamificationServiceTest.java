package com.example.prononciationtest.service;

import com.example.prononciationtest.entity.Badge;
import com.example.prononciationtest.entity.User;
import com.example.prononciationtest.repository.BadgeRepository;
import com.example.prononciationtest.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class GamificationServiceTest {

    @Mock UserRepository userRepo;
    @Mock BadgeRepository badgeRepo;

    @InjectMocks GamificationService gamificationService;

    private User alice;

    @BeforeEach
    void setUp() {
        alice = new User();
        alice.setId(1L);
        alice.setTotalXp(0);
        alice.setCurrentStreak(0);
        alice.setLongestStreak(0);
    }

    @Test
    void recordActivity_incrementsXpAndUpdatesDate() {
        gamificationService.recordActivity(alice, 20, 80);

        assertThat(alice.getTotalXp()).isEqualTo(20);
        assertThat(alice.getLastActivityDate()).isEqualTo(LocalDate.now());
        verify(userRepo).save(alice);
    }

    @Test
    void recordActivity_updatesStreak_whenYesterday() {
        alice.setLastActivityDate(LocalDate.now().minusDays(1));
        alice.setCurrentStreak(5);

        gamificationService.recordActivity(alice, 10, 70);

        assertThat(alice.getCurrentStreak()).isEqualTo(6);
    }

    @Test
    void recordActivity_resetsStreak_whenOlderThanYesterday() {
        alice.setLastActivityDate(LocalDate.now().minusDays(5));
        alice.setCurrentStreak(10);

        gamificationService.recordActivity(alice, 10, 70);

        assertThat(alice.getCurrentStreak()).isEqualTo(1);
    }

    @Test
    void recordActivity_keepsStreak_whenSameDay() {
        alice.setLastActivityDate(LocalDate.now());
        alice.setCurrentStreak(3);

        gamificationService.recordActivity(alice, 10, 70);

        assertThat(alice.getCurrentStreak()).isEqualTo(3);
    }

    @Test
    void recordActivity_awardsBadge_ifPerfectScore() {
        lenient().when(badgeRepo.existsByUserIdAndBadgeKey(anyLong(), anyString())).thenReturn(false);

        gamificationService.recordActivity(alice, 20, 100);

        verify(badgeRepo).save(argThat(b -> "PERFECT_SCORE".equals(b.getBadgeKey())));
    }

    @Test
    void recordActivity_doesNotAwardBadge_ifAlreadyOwned() {
        lenient().when(badgeRepo.existsByUserIdAndBadgeKey(anyLong(), anyString())).thenReturn(true);

        gamificationService.recordActivity(alice, 20, 50);

        verify(badgeRepo, never()).save(any(Badge.class));
    }
}
