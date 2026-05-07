package com.example.prononciationtest.service;

import com.example.prononciationtest.entity.Badge;
import com.example.prononciationtest.entity.User;
import com.example.prononciationtest.repository.BadgeRepository;
import com.example.prononciationtest.repository.UserRepository;
import com.example.prononciationtest.service.iservice.IGamificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
public class GamificationService implements IGamificationService {

    private final UserRepository userRepo;
    private final BadgeRepository badgeRepo;

    /** Called after each completed exercise session or CEFR phrase */
    public void recordActivity(User user, int xpEarned, int score) {
        // Update XP
        user.setTotalXp(user.getTotalXp() + xpEarned);

        // Update streak
        LocalDate today = LocalDate.now();
        LocalDate last = user.getLastActivityDate();
        if (last == null || last.isBefore(today.minusDays(1))) {
            user.setCurrentStreak(1);
        } else if (last.isBefore(today)) {
            user.setCurrentStreak(user.getCurrentStreak() + 1);
        }
        // same day: streak unchanged
        if (user.getCurrentStreak() > user.getLongestStreak()) {
            user.setLongestStreak(user.getCurrentStreak());
        }
        user.setLastActivityDate(today);
        userRepo.save(user);

        // Check badge unlocks
        checkBadges(user, score);
    }

    private void checkBadges(User user, int score) {
        Long uid = user.getId();
        // First activity
        awardIfNew(uid, "FIRST_STEP");
        // Streak badges
        if (user.getCurrentStreak() >= 3)  awardIfNew(uid, "STREAK_3");
        if (user.getCurrentStreak() >= 7)  awardIfNew(uid, "STREAK_7");
        if (user.getCurrentStreak() >= 30) awardIfNew(uid, "STREAK_30");
        // Score badges
        if (score >= 100) awardIfNew(uid, "PERFECT_SCORE");
        if (score >= 90)  awardIfNew(uid, "EXCELLENCE");
        // XP badges
        if (user.getTotalXp() >= 100)  awardIfNew(uid, "XP_100");
        if (user.getTotalXp() >= 500)  awardIfNew(uid, "XP_500");
        if (user.getTotalXp() >= 1000) awardIfNew(uid, "XP_1000");
    }

    private void awardIfNew(Long userId, String key) {
        if (!badgeRepo.existsByUserIdAndBadgeKey(userId, key)) {
            Badge b = new Badge();
            b.setUserId(userId);
            b.setBadgeKey(key);
            badgeRepo.save(b);
        }
    }

    public List<Badge> getBadges(Long userId) {
        return badgeRepo.findByUserId(userId);
    }
}
