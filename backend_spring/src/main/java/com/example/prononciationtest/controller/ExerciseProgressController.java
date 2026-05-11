package com.example.prononciationtest.controller;

import com.example.prononciationtest.entity.ExerciseProgress;
import com.example.prononciationtest.entity.User;
import com.example.prononciationtest.repository.ExerciseProgressRepository;
import com.example.prononciationtest.repository.UserRepository;
import com.example.prononciationtest.service.iservice.IGamificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/exercises/progress")
@CrossOrigin(origins = "http://localhost:8081")
@RequiredArgsConstructor
public class ExerciseProgressController {

    private static final List<String> LEVELS_ORDER = List.of("A1", "A2", "B1", "B2", "C1", "C2");

    private final ExerciseProgressRepository progressRepo;
    private final UserRepository userRepo;
    private final IGamificationService gamificationService;

    // ── GET /api/exercises/progress ─────────────────────────────────────────
    @GetMapping
    public ResponseEntity<?> getProgress(
            @RequestParam(defaultValue = "fr") String lang,
            Authentication auth) {
        User user = getUser(auth);
        List<ExerciseProgress> rows = progressRepo.findByUserIdAndLang(user.getId(), lang);

        String cefrLevel = "en".equals(lang) ? user.getCefrLevelEn() : user.getCefrLevel();
        int cefrIdx = cefrLevel != null ? LEVELS_ORDER.indexOf(cefrLevel) : -1;

        Map<String, Object> result = new LinkedHashMap<>();
        for (ExerciseProgress p : rows) {
            Map<String, Object> data = new LinkedHashMap<>();
            data.put("done",         p.isDone());
            data.put("mastered",     p.isMastered());
            data.put("completed",    p.getCompleted());
            data.put("lastAvgScore", p.getLastAvgScore());
            data.put("sessionsCount",p.getSessionsCount());
            int idx = LEVELS_ORDER.indexOf(p.getLevel());
            boolean unlockedByProgress = idx == 0 || progressRepo.existsByUserIdAndLevelAndLangAndDoneTrue(user.getId(), LEVELS_ORDER.get(idx - 1), lang);
            boolean unlockedByCefr     = cefrIdx >= 0 && cefrIdx >= idx;
            data.put("unlocked", unlockedByProgress || unlockedByCefr);
            result.put(p.getLevel(), data);
        }

        result.putIfAbsent("A1", Map.of("done", false, "mastered", false, "completed", 0, "unlocked", true));

        if (cefrIdx >= 0) {
            for (int i = 0; i <= cefrIdx; i++) {
                String lvl = LEVELS_ORDER.get(i);
                result.putIfAbsent(lvl, Map.of("done", false, "mastered", false, "completed", 0, "unlocked", true));
            }
        }

        return ResponseEntity.ok(result);
    }

    // ── POST /api/exercises/progress/{level}/complete ────────────────────────
    @PostMapping("/{level}/complete")
    public ResponseEntity<?> completeLevel(
            @PathVariable String level,
            @RequestParam int avgScore,
            @RequestParam(defaultValue = "10") int totalPhrases,
            @RequestParam(defaultValue = "fr") String lang,
            Authentication auth) {

        if (!LEVELS_ORDER.contains(level)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Niveau invalide : " + level));
        }

        User user = getUser(auth);

        ExerciseProgress progress = progressRepo
                .findByUserIdAndLevelAndLang(user.getId(), level, lang)
                .orElseGet(() -> {
                    ExerciseProgress p = new ExerciseProgress();
                    p.setUserId(user.getId());
                    p.setLevel(level);
                    p.setLang(lang);
                    return p;
                });

        progress.setDone(true);
        progress.setCompleted(totalPhrases);
        progress.setLastAvgScore(avgScore);
        progress.setMastered(avgScore >= 60);
        progress.setSessionsCount(progress.getSessionsCount() + 1);
        progress.setUpdatedAt(LocalDateTime.now());
        progressRepo.save(progress);

        int xpEarned = avgScore >= 60 ? 20 : 10;
        gamificationService.recordActivity(user, xpEarned, avgScore);

        String nextLevel = null;
        int idx = LEVELS_ORDER.indexOf(level);
        if (idx >= 0 && idx < LEVELS_ORDER.size() - 1) {
            final String unlockLevel = LEVELS_ORDER.get(idx + 1);
            nextLevel = unlockLevel;
            ExerciseProgress next = progressRepo
                    .findByUserIdAndLevelAndLang(user.getId(), unlockLevel, lang)
                    .orElseGet(() -> {
                        ExerciseProgress p = new ExerciseProgress();
                        p.setUserId(user.getId());
                        p.setLevel(unlockLevel);
                        p.setLang(lang);
                        return p;
                    });
            progressRepo.save(next);
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("level",      level);
        response.put("lang",       lang);
        response.put("done",       true);
        response.put("mastered",   avgScore >= 60);
        response.put("avgScore",   avgScore);
        response.put("nextLevel",  nextLevel);
        return ResponseEntity.ok(response);
    }

    // ── GET /api/exercises/progress/{level} ──────────────────────────────────
    @GetMapping("/{level}")
    public ResponseEntity<?> getLevelProgress(
            @PathVariable String level,
            @RequestParam(defaultValue = "fr") String lang,
            Authentication auth) {
        User user = getUser(auth);
        ExerciseProgress p = progressRepo
                .findByUserIdAndLevelAndLang(user.getId(), level, lang)
                .orElse(null);

        String cefrLevel = "en".equals(lang) ? user.getCefrLevelEn() : user.getCefrLevel();
        int cefrIdx = cefrLevel != null ? LEVELS_ORDER.indexOf(cefrLevel) : -1;

        if (p == null) {
            int idx = LEVELS_ORDER.indexOf(level);
            boolean unlocked = idx == 0
                    || progressRepo.existsByUserIdAndLevelAndLangAndDoneTrue(user.getId(), LEVELS_ORDER.get(Math.max(0, idx - 1)), lang)
                    || (cefrIdx >= 0 && cefrIdx >= idx);
            return ResponseEntity.ok(Map.of("level", level, "lang", lang, "done", false, "mastered", false, "completed", 0, "unlocked", unlocked));
        }

        int idx = LEVELS_ORDER.indexOf(level);
        boolean unlocked = idx == 0
                || progressRepo.existsByUserIdAndLevelAndLangAndDoneTrue(user.getId(), LEVELS_ORDER.get(idx - 1), lang)
                || (cefrIdx >= 0 && cefrIdx >= idx);

        return ResponseEntity.ok(Map.of(
            "level",        p.getLevel(),
            "lang",         p.getLang(),
            "done",         p.isDone(),
            "mastered",     p.isMastered(),
            "completed",    p.getCompleted(),
            "lastAvgScore", p.getLastAvgScore(),
            "sessionsCount",p.getSessionsCount(),
            "unlocked",     unlocked
        ));
    }

    // ── Helper ───────────────────────────────────────────────────────────────
    private String getEmail(Authentication auth) {
        if (auth == null) return null;
        if (auth instanceof JwtAuthenticationToken jwt) {
            String email = jwt.getToken().getClaimAsString("email");
            if (email != null && !email.isBlank()) return email;
            String pref = jwt.getToken().getClaimAsString("preferred_username");
            if (pref != null && pref.contains("@")) return pref;
        }
        return auth.getName();
    }

    private User getUser(Authentication auth) {
        String email = getEmail(auth);
        if (email == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Accès non autorisé : authentification manquante");
        }
        return userRepo.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Utilisateur non trouvé"));
    }
}
