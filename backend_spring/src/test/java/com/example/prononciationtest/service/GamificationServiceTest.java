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
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class GamificationServiceTest {

    @Mock
    private UserRepository userRepo;

    @Mock
    private BadgeRepository badgeRepo;

    @InjectMocks
    private GamificationService gamificationService;

    private User user;

    @BeforeEach
    void setUp() {
        user = new User();
        user.setId(123L);
        user.setTotalXp(50);
        user.setCurrentStreak(1);
        user.setLongestStreak(1);
    }

    @Test
    void recordActivity_whenFirstActivity_setsStreakTo1AndAwardsFirstStep() {
        user.setLastActivityDate(null);

        gamificationService.recordActivity(user, 10, 80);

        assertThat(user.getTotalXp()).isEqualTo(60);
        assertThat(user.getCurrentStreak()).isEqualTo(1);
        assertThat(user.getLastActivityDate()).isEqualTo(LocalDate.now());

        verify(userRepo, times(1)).save(user);
        verify(badgeRepo).existsByUserIdAndBadgeKey(123L, "FIRST_STEP");
    }

    @Test
    void recordActivity_consecutiveDays_incrementsStreak() {
        user.setLastActivityDate(LocalDate.now().minusDays(1));
        user.setCurrentStreak(2);
        user.setLongestStreak(2);

        gamificationService.recordActivity(user, 20, 85);

        assertThat(user.getCurrentStreak()).isEqualTo(3);
        assertThat(user.getLongestStreak()).isEqualTo(3);
    }

    @Test
    void recordActivity_gapBetweenActivities_resetsStreakTo1() {
        user.setLastActivityDate(LocalDate.now().minusDays(3));
        user.setCurrentStreak(5);
        user.setLongestStreak(5);

        gamificationService.recordActivity(user, 20, 85);

        assertThat(user.getCurrentStreak()).isEqualTo(1);
        assertThat(user.getLongestStreak()).isEqualTo(5); // longest remains 5
    }

    @Test
    void recordActivity_highScore_awardsPerfectScoreAndExcellence() {
        when(badgeRepo.existsByUserIdAndBadgeKey(any(), anyString())).thenReturn(false);

        gamificationService.recordActivity(user, 100, 100);

        verify(badgeRepo).existsByUserIdAndBadgeKey(123L, "PERFECT_SCORE");
        verify(badgeRepo).existsByUserIdAndBadgeKey(123L, "EXCELLENCE");
        verify(badgeRepo).existsByUserIdAndBadgeKey(123L, "XP_100");
    }

    @Test
    void getBadges_returnsUserBadges() {
        List<Badge> expected = List.of(new Badge());
        when(badgeRepo.findByUserId(123L)).thenReturn(expected);

        List<Badge> result = gamificationService.getBadges(123L);

        assertThat(result).isEqualTo(expected);
    }
}
