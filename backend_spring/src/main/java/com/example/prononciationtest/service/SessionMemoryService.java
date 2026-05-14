package com.example.prononciationtest.service;

import com.example.prononciationtest.entity.MasterSession;
import com.example.prononciationtest.repository.MasterSessionRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CompletableFuture;

/**
 * Cross-mode session memory — shared by ChatbotAgent, LevelTestAgent, and exercise flow.
 *
 * Strategy:
 *   - Hot path: in-memory ConcurrentHashMap (fast, 1hr TTL)
 *   - Persistence: async flush to PostgreSQL master_sessions table
 *   - On getOrCreate: if not in memory but exists in DB (server restart) → restore from DB
 */
@Service
public class SessionMemoryService {

    private static final Logger log = LoggerFactory.getLogger(SessionMemoryService.class);
    private static final long SESSION_TTL_MS = 3_600_000L; // 1 hour

    private final ConcurrentHashMap<String, SessionData> sessions = new ConcurrentHashMap<>();
    private final MasterSessionRepository masterSessionRepo;
    private final ObjectMapper objectMapper;

    public SessionMemoryService(MasterSessionRepository masterSessionRepo, ObjectMapper objectMapper) {
        this.masterSessionRepo = masterSessionRepo;
        this.objectMapper      = objectMapper;
    }

    // ── Create / read ─────────────────────────────────────────────────────────

    public SessionData getOrCreate(String sessionId, String lang, String level) {
        evictExpired();
        return sessions.computeIfAbsent(sessionId, id -> {
            // Try to restore from DB first (handles server restart)
            return masterSessionRepo.findBySessionId(id)
                .map(this::fromEntity)
                .orElseGet(() -> {
                    SessionData fresh = new SessionData(id, lang, level);
                    persistAsync(fresh);
                    return fresh;
                });
        });
    }

    public SessionData get(String sessionId) {
        return sessions.get(sessionId);
    }

    public boolean exists(String sessionId) {
        SessionData s = sessions.get(sessionId);
        if (s != null) return (System.currentTimeMillis() - s.createdAt) < SESSION_TTL_MS;
        // Check DB (session may be valid but not in memory after restart)
        return masterSessionRepo.findBySessionId(sessionId).map(ms -> {
            // Restore to memory
            sessions.putIfAbsent(sessionId, fromEntity(ms));
            return true;
        }).orElse(false);
    }

    public void remove(String sessionId) {
        sessions.remove(sessionId);
        masterSessionRepo.findBySessionId(sessionId).ifPresent(masterSessionRepo::delete);
    }

    // ── Mutations ─────────────────────────────────────────────────────────────

    public void updateCefrLevel(String sessionId, String newLevel) {
        SessionData s = sessions.get(sessionId);
        if (s != null) { s.cefrLevel = newLevel; persistAsync(s); }
    }

    public String getCefrLevel(String sessionId) {
        SessionData s = sessions.get(sessionId);
        return s != null ? s.cefrLevel : "B1";
    }

    public void addXp(String sessionId, int xp) {
        SessionData s = sessions.get(sessionId);
        if (s != null) { s.totalXp += xp; persistAsync(s); }
    }

    public int getTotalXp(String sessionId) {
        SessionData s = sessions.get(sessionId);
        return s != null ? s.totalXp : 0;
    }

    public void addWeakWords(String sessionId, List<String> words) {
        SessionData s = sessions.get(sessionId);
        if (s != null && words != null) {
            // Deduplicate — avoid filling error_log with repeated identical words
            Set<String> existing = new HashSet<>(s.errorLog);
            for (String w : words) {
                String clean = w != null ? w.trim().toLowerCase() : "";
                if (!clean.isBlank() && !existing.contains(clean)) {
                    s.errorLog.add(clean);
                    existing.add(clean);
                }
            }
            persistAsync(s);
        }
    }

    public List<String> getErrorLog(String sessionId) {
        SessionData s = sessions.get(sessionId);
        return s != null ? Collections.unmodifiableList(s.errorLog) : List.of();
    }

    public void removeWeakWord(String sessionId, String word) {
        SessionData s = sessions.get(sessionId);
        if (s != null && word != null) {
            s.errorLog.remove(word.trim().toLowerCase());
            persistAsync(s);
        }
    }

    public void setTestSessionId(String sessionId, String testSessionId) {
        SessionData s = sessions.get(sessionId);
        if (s != null) { s.testSessionId = testSessionId; persistAsync(s); }
    }

    public String getTestSessionId(String sessionId) {
        SessionData s = sessions.get(sessionId);
        return s != null ? s.testSessionId : null;
    }

    public void incrementExerciseRound(String sessionId) {
        SessionData s = sessions.get(sessionId);
        if (s != null) { s.exerciseRound++; persistAsync(s); }
    }

    public int getExerciseRound(String sessionId) {
        SessionData s = sessions.get(sessionId);
        return s != null ? s.exerciseRound : 0;
    }

    public void incrementChatRound(String sessionId) {
        SessionData s = sessions.get(sessionId);
        if (s != null) { s.chatRound++; persistAsync(s); }
    }

    public int getChatRound(String sessionId) {
        SessionData s = sessions.get(sessionId);
        return s != null ? s.chatRound : 0;
    }

    // ── Async persistence ─────────────────────────────────────────────────────

    public void persistAsync(SessionData s) {
        CompletableFuture.runAsync(() -> doPersist(s));
    }

    private void doPersist(SessionData s) {
        try {
            MasterSession entity = masterSessionRepo.findBySessionId(s.sessionId)
                .orElseGet(MasterSession::new);
            entity.setSessionId(s.sessionId);
            entity.setLang(s.lang);
            entity.setCefrLevel(s.cefrLevel);
            entity.setTotalXp(s.totalXp);
            entity.setExerciseRound(s.exerciseRound);
            entity.setChatRound(s.chatRound);
            entity.setTestSessionId(s.testSessionId);
            entity.setErrorLogJson(objectMapper.writeValueAsString(s.errorLog));
            entity.setUpdatedAt(LocalDateTime.now());
            if (entity.getCreatedAt() == null) entity.setCreatedAt(LocalDateTime.now());
            masterSessionRepo.save(entity);
        } catch (Exception e) {
            log.warn("[SessionMemory] persist failed for {}: {}", s.sessionId, e.getMessage());
        }
    }


    // ── Eviction ─────────────────────────────────────────────────────────────

    private void evictExpired() {
        long now = System.currentTimeMillis();
        sessions.entrySet().removeIf(e -> (now - e.getValue().createdAt) > SESSION_TTL_MS);
    }

    // ── DB → Memory restore ───────────────────────────────────────────────────

    private SessionData fromEntity(MasterSession entity) {
        SessionData s = new SessionData(entity.getSessionId(), entity.getLang(), entity.getCefrLevel());
        s.totalXp       = entity.getTotalXp();
        s.exerciseRound = entity.getExerciseRound();
        s.chatRound     = entity.getChatRound();
        s.testSessionId = entity.getTestSessionId();
        try {
            List<String> log = objectMapper.readValue(
                entity.getErrorLogJson() != null ? entity.getErrorLogJson() : "[]",
                new TypeReference<>() {});
            s.errorLog.addAll(log);
        } catch (Exception ex) { log.debug("Could not parse errorLog JSON: {}", ex.getMessage()); }
        return s;
    }

    // ── Inner data holder ─────────────────────────────────────────────────────

    public static class SessionData {
        public final String sessionId;
        public final String lang;
        public volatile String cefrLevel;
        public volatile int totalXp;
        public volatile int exerciseRound;
        public volatile int chatRound;
        public volatile String testSessionId;
        public final List<String> errorLog = new ArrayList<>();
        public final long createdAt = System.currentTimeMillis();

        SessionData(String sessionId, String lang, String level) {
            this.sessionId = sessionId;
            this.lang      = lang  != null ? lang  : "fr";
            this.cefrLevel = level != null ? level : "B1";
        }
    }
}
