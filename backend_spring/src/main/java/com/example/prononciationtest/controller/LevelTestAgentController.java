package com.example.prononciationtest.controller;

import com.example.prononciationtest.agent.LevelTestAgent;
import com.example.prononciationtest.entity.*;
import com.example.prononciationtest.repository.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;
import com.example.prononciationtest.security.SecurityUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.*;
import java.util.Comparator;

/**
 * Level Test routes — delegates all state-machine logic to LevelTestAgent (LangGraph4J).
 * Handles: HTTP auth, DB persistence, history queries.
 */
@RestController
@CrossOrigin(origins = "http://localhost:8081")
@RequestMapping("/api/level-test")
@Tag(name = "Level Test Agent", description = "CEFR level assessment — LangGraph4J agent + PostgreSQL")
public class LevelTestAgentController {

    private static final Logger log = LoggerFactory.getLogger(LevelTestAgentController.class);
    private static final String KEY_SCORE = "score";

    private final LevelTestAgent               levelTestAgent;
    private final UserRepository               userRepo;
    private final CEFRSessionRepository        cefrSessionRepo;
    private final PlannerStepResultRepository  stepRepo;
    private final UserSessionRepository        userSessionRepo;
    private final SpacedRepetitionRepository   srRepo;

    public LevelTestAgentController(
            LevelTestAgent                    levelTestAgent,
            UserRepository                    userRepo,
            CEFRSessionRepository             cefrSessionRepo,
            PlannerStepResultRepository       stepRepo,
            UserSessionRepository             userSessionRepo,
            SpacedRepetitionRepository        srRepo) {
        this.levelTestAgent  = levelTestAgent;
        this.userRepo         = userRepo;
        this.cefrSessionRepo  = cefrSessionRepo;
        this.stepRepo         = stepRepo;
        this.userSessionRepo  = userSessionRepo;
        this.srRepo           = srRepo;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // POST /start
    // ═════════════════════════════════════════════════════════════════════════

    @PostMapping("/start")
    @Operation(summary = "Start CEFR level assessment")
    public ResponseEntity<Map<String, Object>> start(
            @RequestParam(defaultValue = "fr") String lang,
            Authentication auth) {
        try {
            String sessionId = UUID.randomUUID().toString();
            String userName = "apprenant";

            // Persist session to DB (non-blocking)
            try {
                User user = SecurityUtils.getAuthenticatedUserOrNull(auth, userRepo);
                if (user != null) {
                    if (user.getFullName() != null && !user.getFullName().isBlank()) {
                        userName = user.getFullName();
                    }
                    CEFRSession s = new CEFRSession();
                    s.setSessionId(sessionId);
                    s.setUserId(user.getId());
                    s.setLang(lang);
                    s.setStatus("IN_PROGRESS");
                    s.setStartedAt(LocalDateTime.now());
                    cefrSessionRepo.save(s);
                }
            } catch (Exception dbEx) {
                log.warn("[LevelTest] DB session creation failed: {}", dbEx.getMessage());
            }

            Map<String, Object> result = levelTestAgent.start(sessionId, lang, userName);
            return ResponseEntity.ok(result);

        } catch (Exception e) {
            log.error("[LevelTest] start error: {}", e.getMessage());
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Agent unavailable: " + e.getMessage()));
        }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // POST /next
    // ═════════════════════════════════════════════════════════════════════════

    @PostMapping("/next")
    @Operation(summary = "Submit score for current step and get next")
    public ResponseEntity<Map<String, Object>> next(
            @RequestParam String sessionId,
            @RequestParam(required = false, defaultValue = "") String phrase,
            @RequestParam int score,
            Authentication auth) {
        try {
            Map<String, Object> result = levelTestAgent.next(sessionId, score, phrase);

            if (Boolean.TRUE.equals(result.get("done"))) {
                try { persistResults(sessionId, result, auth); }
                catch (Exception dbEx) { log.warn("[LevelTest] DB persist failed: {}", dbEx.getMessage()); }
            }

            return ResponseEntity.ok(result);

        } catch (Exception e) {
            log.error("[LevelTest] next error session={}: {}", sessionId, e.getMessage());
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Agent error: " + e.getMessage()));
        }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // POST /feedback  — Task 1: feedback only (~2s)
    // ═════════════════════════════════════════════════════════════════════════

    @PostMapping("/feedback")
    @Operation(summary = "Task 1: generate feedback for current step (fast)")
    public ResponseEntity<Map<String, Object>> submitFeedback(
            @RequestParam String sessionId,
            @RequestParam(required = false, defaultValue = "") String phrase,
            @RequestParam int score,
            Authentication auth) {
        try {
            Map<String, Object> result = levelTestAgent.submitFeedback(sessionId, score, phrase);
            if (Boolean.TRUE.equals(result.get("done"))) {
                try { persistResults(sessionId, result, auth); }
                catch (Exception dbEx) { log.warn("[LevelTest] DB persist failed: {}", dbEx.getMessage()); }
            }
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("[LevelTest] feedback error session={}: {}", sessionId, e.getMessage());
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Agent error: " + e.getMessage()));
        }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // POST /next-phrase  — Task 2: prefetch next phrase (~3s, while user reads feedback)
    // ═════════════════════════════════════════════════════════════════════════

    @PostMapping("/next-phrase")
    @Operation(summary = "Task 2: prefetch next sound + phrase (call after /feedback returns)")
    public ResponseEntity<Map<String, Object>> nextPhrase(@RequestParam String sessionId) {
        try {
            Map<String, Object> result = levelTestAgent.fetchNextPhrase(sessionId);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("[LevelTest] next-phrase error session={}: {}", sessionId, e.getMessage());
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Agent error: " + e.getMessage()));
        }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // POST /finish
    // ═════════════════════════════════════════════════════════════════════════

    @PostMapping("/finish")
    @Operation(summary = "Force-finish assessment early")
    public ResponseEntity<Map<String, Object>> finish(
            @RequestParam String sessionId,
            Authentication auth) {
        try {
            Map<String, Object> result = levelTestAgent.finish(sessionId);

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> history =
                (List<Map<String, Object>>) result.getOrDefault("history", List.of());

            if (!history.isEmpty()) {
                try { persistResults(sessionId, result, auth); }
                catch (Exception dbEx) { log.warn("[LevelTest] DB persist failed: {}", dbEx.getMessage()); }
            } else {
                cefrSessionRepo.findBySessionId(sessionId).ifPresent(s -> {
                    s.setStatus("ABANDONED");
                    s.setCompletedAt(LocalDateTime.now());
                    cefrSessionRepo.save(s);
                });
            }

            return ResponseEntity.ok(result);

        } catch (Exception e) {
            log.error("[LevelTest] finish error session={}: {}", sessionId, e.getMessage());
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Agent error: " + e.getMessage()));
        }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // GET /history
    // ═════════════════════════════════════════════════════════════════════════

    @GetMapping("/history")
    @Operation(summary = "User test history")
    public ResponseEntity<Object> history(Authentication auth) {
        try {
            User user = SecurityUtils.getAuthenticatedUser(auth, userRepo);

            List<Map<String, Object>> sessions = cefrSessionRepo
                    .findByUserIdOrderByStartedAtDesc(user.getId())
                    .stream()
                    .map(s -> {
                        Map<String, Object> m = new LinkedHashMap<>();
                        m.put("session_id",   s.getSessionId());
                        m.put("final_level",  s.getFinalLevel());
                        m.put("lang",         s.getLang());
                        m.put("status",       s.getStatus());
                        m.put("started_at",   s.getStartedAt()   != null ? s.getStartedAt().toString()   : null);
                        m.put("completed_at", s.getCompletedAt() != null ? s.getCompletedAt().toString() : null);
                        return m;
                    })
                    .toList();
            return ResponseEntity.ok(sessions);

        } catch (ResponseStatusException rse) {
            throw rse;
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // GET /progression — score evolution over time for the current user
    // ═════════════════════════════════════════════════════════════════════════

    @GetMapping("/progression")
    @Operation(summary = "User score progression over all completed CEFR tests")
    public ResponseEntity<Map<String, Object>> progression(Authentication auth) {
        try {
            User user = SecurityUtils.getAuthenticatedUser(auth, userRepo);

            List<CEFRSession> sessions = cefrSessionRepo
                    .findByUserIdOrderByStartedAtDesc(user.getId())
                    .stream()
                    .filter(s -> "COMPLETED".equals(s.getStatus()) && s.getAvgScore() != null)
                    .sorted(Comparator.comparing(CEFRSession::getStartedAt))
                    .toList();

            List<Map<String, Object>> data = sessions.stream().map(s -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("date",        s.getStartedAt().toLocalDate().toString());
                m.put(KEY_SCORE,       s.getAvgScore());
                m.put("level",       s.getFinalLevel());
                m.put("lang",        s.getLang());
                return m;
            }).toList();

            // Stats
            int count = data.size();
            int firstScore = count > 0 ? (int) ((Map<?,?>)data.get(0)).get(KEY_SCORE) : 0;
            int lastScore  = count > 0 ? (int) ((Map<?,?>)data.get(count-1)).get(KEY_SCORE) : 0;
            int bestScore  = data.stream().mapToInt(m -> (int) m.get(KEY_SCORE)).max().orElse(0);
            int improvement = count > 1 ? lastScore - firstScore : 0;

            Map<String, Object> resp = new LinkedHashMap<>();
            resp.put("sessions",    data);
            resp.put("count",       count);
            resp.put("first_score", firstScore);
            resp.put("last_score",  lastScore);
            resp.put("best_score",  bestScore);
            resp.put("improvement", improvement);
            return ResponseEntity.ok(resp);
        } catch (ResponseStatusException rse) {
            throw rse;
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // GET /history/{sessionId}/steps
    // ═════════════════════════════════════════════════════════════════════════

    @GetMapping("/history/{sessionId}/steps")
    @Operation(summary = "Step detail for a past test")
    public ResponseEntity<Object> historySteps(@PathVariable String sessionId, Authentication auth) {
        try {
            List<Map<String, Object>> steps = stepRepo
                    .findBySessionIdOrderByStepNumber(sessionId)
                    .stream()
                    .map(s -> {
                        Map<String, Object> m = new LinkedHashMap<>();
                        m.put("step",         s.getStepNumber());
                        m.put("sound_label",  s.getTargetSound());
                        m.put("phrase",       s.getPhrase());
                        m.put(KEY_SCORE,        s.getScore());
                        m.put("progressed",   s.getProgressed());
                        m.put("attempted_at", s.getAttemptedAt() != null ? s.getAttemptedAt().toString() : null);
                        return m;
                    })
                    .toList();
            return ResponseEntity.ok(steps);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // DB persistence
    // ═════════════════════════════════════════════════════════════════════════

    @SuppressWarnings("unchecked")
    private void persistResults(String sessionId, Map<String, Object> body, Authentication auth) {
        User user = SecurityUtils.getAuthenticatedUserOrNull(auth, userRepo);
        if (user == null) { log.warn("[LevelTest] User not found for persist"); return; }

        String finalLevel = ((String) body.getOrDefault("final_level", "B1")).toUpperCase().trim();
        int    avgScore   = body.get(KEY_SCORE) instanceof Number n ? n.intValue() : 0;
        String feedback   = (String) body.getOrDefault("feedback", "");
        List<Map<String, Object>> history =
            (List<Map<String, Object>>) body.getOrDefault("history", List.of());

        String lang = cefrSessionRepo.findBySessionId(sessionId)
                .map(CEFRSession::getLang).orElse("fr");

        // 1. Update CEFRSession
        CEFRSession cefrSession = cefrSessionRepo.findBySessionId(sessionId)
                .orElseGet(() -> {
                    CEFRSession s = new CEFRSession();
                    s.setSessionId(sessionId);
                    s.setUserId(user.getId());
                    s.setLang(lang);
                    s.setStartedAt(LocalDateTime.now());
                    return s;
                });
        cefrSession.setFinalLevel(finalLevel);
        cefrSession.setAvgScore(avgScore);
        cefrSession.setStatus("COMPLETED");
        cefrSession.setCompletedAt(LocalDateTime.now());
        cefrSessionRepo.save(cefrSession);

        // 2. Save each step
        for (Map<String, Object> h : history) {
            int stepScore = h.get(KEY_SCORE) instanceof Number n ? n.intValue() : 0;
            PlannerStepResult step = new PlannerStepResult();
            step.setSessionId(sessionId);
            step.setUserId(user.getId());
            step.setStepNumber(h.get("step") instanceof Number n ? n.intValue() : 0);
            step.setTargetSound((String) h.getOrDefault("sound_label", ""));
            step.setPhrase((String)      h.getOrDefault("phrase",      ""));
            step.setScore(stepScore);
            step.setProgressed(stepScore >= 60);
            step.setLang(lang);
            step.setLevel(finalLevel);
            step.setAttemptedAt(LocalDateTime.now());
            stepRepo.save(step);
        }

        // 3. Enroll failed sounds in spaced-repetition queue
        Map<String, Integer> worstScorePerSound = new LinkedHashMap<>();
        Map<String, String>  labelPerSound      = new LinkedHashMap<>();
        for (Map<String, Object> h : history) {
            String soundKey   = (String) h.getOrDefault("sound",       "");
            String soundLabel = (String) h.getOrDefault("sound_label", soundKey);
            int    sc         = h.get(KEY_SCORE) instanceof Number n ? n.intValue() : 0;
            if (soundKey.isBlank()) continue;
            worstScorePerSound.merge(soundKey, sc, Math::min);
            labelPerSound.putIfAbsent(soundKey, soundLabel);
        }
        for (Map.Entry<String, Integer> e : worstScorePerSound.entrySet()) {
            if (e.getValue() >= 70) continue;
            String soundKey   = e.getKey();
            String soundLabel = labelPerSound.getOrDefault(soundKey, soundKey);
            SpacedRepetitionItem item =
                srRepo.findByUserIdAndWordIgnoreCaseAndItemType(user.getId(), soundKey, "SOUND")
                    .orElseGet(() -> {
                        SpacedRepetitionItem i = new SpacedRepetitionItem();
                        i.setUserId(user.getId());
                        i.setWord(soundKey);
                        i.setItemType("SOUND");
                        i.setSoundLabel(soundLabel);
                        i.setLang(lang);
                        i.setLevel(finalLevel);
                        i.setIntervalDays(1);
                        i.setNextReview(java.time.LocalDate.now().plusDays(1));
                        i.setLastSeen(java.time.LocalDate.now());
                        i.setErrorCount(0);
                        return i;
                    });
            item.setErrorCount(item.getErrorCount() + 1);
            item.setLastSeen(java.time.LocalDate.now());
            int next = item.getIntervalDays() >= 1 && item.getErrorCount() > 1
                    ? nextSrInterval(item.getIntervalDays()) : 1;
            item.setIntervalDays(next);
            item.setNextReview(java.time.LocalDate.now().plusDays(next));
            srRepo.save(item);
        }

        // 4. Update user CEFR profile — level stored per language
        if ("en".equalsIgnoreCase(lang)) {
            user.setCefrLevelEn(finalLevel);
            user.setCefrCompletedEn(true);
        } else {
            user.setCefrLevel(finalLevel);
            user.setCefrCompleted(true);
        }
        userRepo.save(user);

        // 5. Add UserSession entry
        UserSession us = new UserSession();
        us.setUser(user);
        us.setType("Level Test");
        us.setPhrase("Test de niveau — " + history.size() + " sons évalués");
        us.setScore(avgScore);
        us.setLang(lang);
        us.setLevel(finalLevel);
        us.setFeedback(feedback.length() > 500 ? feedback.substring(0, 497) + "…" : feedback);
        us.setCreatedAt(LocalDateTime.now());
        userSessionRepo.save(us);

        log.info("[LevelTest] Persisted: userId={} level={} score={} steps={}",
                user.getId(), finalLevel, avgScore, history.size());
    }

    private static final int[] SR_INTERVALS = {1, 3, 7, 14, 30};

    private int nextSrInterval(int current) {
        for (int i = 0; i < SR_INTERVALS.length - 1; i++) {
            if (current <= SR_INTERVALS[i]) return SR_INTERVALS[i + 1];
        }
        return 30;
    }
}
