package com.example.prononciationtest.service.iservice;

import com.example.prononciationtest.entity.Badge;
import com.example.prononciationtest.entity.User;

import java.util.List;

public interface IGamificationService {

    /**
     * Enregistre une activité : met à jour XP, streak et débloque les badges.
     *
     * @param user      utilisateur concerné
     * @param xpEarned  XP gagnés lors de la session
     * @param score     score obtenu (sur 100)
     */
    void recordActivity(User user, int xpEarned, int score);

    /**
     * Retourne tous les badges débloqués par un utilisateur.
     *
     * @param userId identifiant de l'utilisateur
     * @return liste de {@link Badge}
     */
    List<Badge> getBadges(Long userId);
}
