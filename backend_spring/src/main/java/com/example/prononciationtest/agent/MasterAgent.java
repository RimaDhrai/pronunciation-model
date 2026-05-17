package com.example.prononciationtest.agent;

import com.example.prononciationtest.service.OllamaService;
import com.example.prononciationtest.service.SessionMemoryService;
import com.example.prononciationtest.service.SessionMemoryService.SessionData;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.function.Consumer;

/**
 * Master Agent — single entry point for CHAT | TEST | TEST_FINISH | EXERCISE.
 *
 * Routing is explicit (mode field) — no LLM used for routing.
 * DB persistence stays in LevelTestAgentController; this class only coordinates live state.
 */
@Component
@RequiredArgsConstructor
public class MasterAgent {

    private static final Logger log = LoggerFactory.getLogger(MasterAgent.class);

    private final ChatbotAgent       chatbotAgent;
    private final LevelTestAgent     levelTestAgent;
    private final OllamaService      ollamaService;
    private final SessionMemoryService sessionMemory;

    // ── Session lifecycle ─────────────────────────────────────────────────────

    /**
     * Creates a master session: starts the chatbot sub-session and registers memory.
     * Returns the chatbot opening greeting.
     */
    public Map<String, Object> createSession(String sessionId, String lang, String level, String scenario) {
        sessionMemory.getOrCreate(sessionId, lang, level);

        String greeting = chatbotAgent.startSession(sessionId, lang, level, scenario);

        return Map.of(
            "session_id",  sessionId,
            "lang",        lang  != null ? lang  : "fr",
            "cefr_level",  level != null ? level : "B1",
            "greeting",    greeting
        );
    }

    // ── Main turn ─────────────────────────────────────────────────────────────

    /**
     * Synchronous turn. For CHAT with SSE, use {@link #turnStreaming} instead.
     */
    public Map<String, Object> turn(String sessionId, String mode, String lang,
                                    String input, List<String> weakWords, Double pronScore,
                                    String scenario, Integer scoreInput, String phrase,
                                    List<String> phonemeErrors) {

        if (!sessionMemory.exists(sessionId)) {
            return Map.of("error", "SESSION_NOT_FOUND", "session_id", sessionId);
        }

        // Phoneme errors from FastAPI /analyze — persist regardless of mode
        if (phonemeErrors != null && !phonemeErrors.isEmpty()) {
            sessionMemory.addWeakWords(sessionId, phonemeErrors);
        }

        String normalizedMode = mode != null ? mode.toUpperCase() : "CHAT";

        Map<String, Object> result = switch (normalizedMode) {
            case "TEST"        -> handleTest(sessionId, lang, scoreInput, phrase);
            case "TEST_FINISH" -> handleTestFinish(sessionId);
            case "EXERCISE"    -> handleExercise(sessionId, lang, scoreInput);
            default            -> handleChat(sessionId, input, weakWords, pronScore);
        };

        SessionData mem = sessionMemory.get(sessionId);
        result = new HashMap<>(result);
        result.put("mode",        normalizedMode);
        result.put("cefr_level",  mem != null ? mem.cefrLevel : "B1");
        result.put("total_xp",    sessionMemory.getTotalXp(sessionId));
        result.put("error_count", sessionMemory.getErrorLog(sessionId).size());
        return Collections.unmodifiableMap(result);
    }

    /**
     * SSE streaming turn for CHAT mode. Tokens are forwarded via {@code onToken}.
     * Returns a CompletableFuture-friendly signature — call from controller's async SSE thread.
     */
    public String turnStreaming(String sessionId, String input, List<String> weakWords,
                                Double pronScore, Consumer<String> onToken) {
        if (!sessionMemory.exists(sessionId)) return "SESSION_NOT_FOUND";
        try {
            return chatbotAgent.chatStreaming(sessionId, input, weakWords, pronScore, onToken)
                               .get(55, java.util.concurrent.TimeUnit.SECONDS);
        } catch (Exception e) {
            log.error("[Master SSE] error: {}", e.getMessage());
            String fallback = "Je traite ta réponse, réessaie dans un instant ! 🙏";
            if (onToken != null) onToken.accept(fallback);
            return fallback;
        }
    }

    // ── Stats ─────────────────────────────────────────────────────────────────

    public Map<String, Object> getStats(String sessionId) {
        if (!sessionMemory.exists(sessionId)) {
            return Map.of("error", "SESSION_NOT_FOUND");
        }
        return Map.of(
            "session_id",     sessionId,
            "cefr_level",     sessionMemory.getCefrLevel(sessionId),
            "total_xp",       sessionMemory.getTotalXp(sessionId),
            "exercise_round", sessionMemory.getExerciseRound(sessionId),
            "chat_round",     sessionMemory.getChatRound(sessionId),
            "error_log",      sessionMemory.getErrorLog(sessionId)
        );
    }

    // ── Mode handlers ─────────────────────────────────────────────────────────

    private Map<String, Object> handleChat(String sessionId, String input,
                                           List<String> weakWords, Double pronScore) {
        if (weakWords != null && !weakWords.isEmpty()) {
            sessionMemory.addWeakWords(sessionId, weakWords);
        }
        String response = chatbotAgent.chat(sessionId, input, weakWords, pronScore);
        return new HashMap<>(Map.of("response", response));
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> handleTest(String sessionId, String lang,
                                           Integer scoreInput, String phrase) {
        String testSid = sessionMemory.getTestSessionId(sessionId);

        if (testSid == null) {
            // First step: start the level test (use master sessionId as test sessionId)
            Map<String, Object> startResult = levelTestAgent.start(sessionId, lang, "apprenant");
            sessionMemory.setTestSessionId(sessionId, sessionId);
            return new HashMap<>(startResult);
        }

        // Subsequent step: submit score for previous phrase, get next
        int score = scoreInput != null ? scoreInput : 0;
        String spokenPhrase = (phrase != null && !phrase.isBlank()) ? phrase : "";

        Map<String, Object> nextResult = levelTestAgent.next(testSid, score, spokenPhrase);

        // Accumulate XP from test score
        sessionMemory.addXp(sessionId, computeXp(score));

        // next() auto-completes when all steps done (done=true → buildFinishResponse)
        if (Boolean.TRUE.equals(nextResult.get("done"))) {
            propagateFinishResult(sessionId, nextResult);
        }

        return new HashMap<>(nextResult);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> handleTestFinish(String sessionId) {
        String testSid = sessionMemory.getTestSessionId(sessionId);
        if (testSid == null) {
            return new HashMap<>(Map.of("error", "NO_TEST_IN_PROGRESS"));
        }

        Map<String, Object> finishResult = levelTestAgent.finish(testSid);
        propagateFinishResult(sessionId, finishResult);
        return new HashMap<>(finishResult);
    }

    /** Shared logic: after test completes, sync level + weaknesses into session memory. */
    @SuppressWarnings("unchecked")
    private void propagateFinishResult(String sessionId, Map<String, Object> finishResult) {
        // LevelTestAgent returns "final_level" (not "cefr_level")
        Object finalLevel = finishResult.get("final_level");
        if (finalLevel instanceof String lvl && !lvl.isBlank()) {
            sessionMemory.updateCefrLevel(sessionId, lvl);
            chatbotAgent.updateLevel(sessionId, lvl);
            log.info("[Master] CEFR updated → {} for session {}", lvl, sessionId);
        }

        // Weaknesses returned under "weaknesses" key
        Object weaknesses = finishResult.get("weaknesses");
        if (weaknesses instanceof List<?> list) {
            sessionMemory.addWeakWords(sessionId, (List<String>) list);
        }

        // Clear test session
        sessionMemory.setTestSessionId(sessionId, null);
    }

    private Map<String, Object> handleExercise(String sessionId, String lang, Integer scoreInput) {
        String level = sessionMemory.getCefrLevel(sessionId);

        // Phase A — record previous score if present
        int xpEarned = 0;
        String scoreLabel = null;
        if (scoreInput != null) {
            xpEarned = computeXp(scoreInput);
            sessionMemory.addXp(sessionId, xpEarned);
            scoreLabel = scoreLabel(scoreInput);
            // phoneme_errors are already persisted globally (lines 65-67) — no placeholder needed
        }

        // Phase B — get next phrase
        sessionMemory.incrementExerciseRound(sessionId);
        int round = sessionMemory.getExerciseRound(sessionId);

        String phrase = ollamaService.generatePhrase(lang != null ? lang : "fr", level);
        if (phrase == null || phrase.isBlank()) {
            phrase = "Répète cette phrase clairement.";
        }

        Map<String, Object> result = new HashMap<>();
        result.put("phrase",    phrase);
        result.put("round",     round);
        result.put("xp_earned", xpEarned);
        result.put("total_xp",  sessionMemory.getTotalXp(sessionId));
        if (scoreLabel != null) result.put("score_label", scoreLabel);
        return result;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static int computeXp(int score) {
        if (score >= 90) return 15;
        if (score >= 75) return 10;
        if (score >= 60) return 5;
        return 2;
    }

    private static String scoreLabel(int score) {
        if (score >= 90) return "Excellent";
        if (score >= 75) return "Bien";
        if (score >= 60) return "Passable";
        return "À améliorer";
    }
}
