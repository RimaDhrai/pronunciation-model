package com.example.prononciationtest.controller;

import com.example.prononciationtest.agent.MasterAgent;
import com.example.prononciationtest.service.dto.MasterTurnRequest;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * REST + SSE endpoints for the Master Agent.
 *
 * POST /api/master/session          → create session (returns greeting)
 * POST /api/master/turn             → sync turn (TEST / EXERCISE / CHAT non-streaming)
 * POST /api/master/turn/stream      → SSE turn for CHAT mode (real-time tokens)
 * GET  /api/master/session/{id}/stats
 */
@RestController
@CrossOrigin(origins = "http://localhost:8081")
@RequestMapping("/api/master")
@RequiredArgsConstructor
public class MasterController {

    private static final Logger log = LoggerFactory.getLogger(MasterController.class);

    private final MasterAgent masterAgent;

    private final ExecutorService ssePool = Executors.newCachedThreadPool(r -> {
        Thread t = new Thread(r, "master-sse-" + System.nanoTime());
        t.setDaemon(true);
        return t;
    });

    // ── Create session ────────────────────────────────────────────────────────

    @PostMapping("/session")
    public ResponseEntity<Map<String, Object>> createSession(@RequestBody Map<String, Object> body) {
        String sessionId = (String) body.getOrDefault("session_id", UUID.randomUUID().toString());
        String lang      = (String) body.getOrDefault("lang",       "fr");
        String level     = (String) body.getOrDefault("level",      "B1");
        String scenario  = (String) body.getOrDefault("scenario",   "");

        try {
            Map<String, Object> result = masterAgent.createSession(sessionId, lang, level, scenario);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("[Master] createSession error: {}", e.getMessage());
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // ── Sync turn ─────────────────────────────────────────────────────────────

    @PostMapping("/turn")
    public ResponseEntity<Map<String, Object>> turn(@Valid @RequestBody MasterTurnRequest req) {
        if (req.sessionId == null || req.sessionId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "session_id required"));
        }

        try {
            Map<String, Object> result = masterAgent.turn(
                req.sessionId, req.mode, req.lang,
                req.input, req.weakWords, req.pronScore,
                req.scenario, req.scoreInput, req.phrase, req.phonemeErrors
            );
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("[Master] turn error: {}", e.getMessage());
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // ── SSE streaming turn (CHAT mode) ────────────────────────────────────────

    @PostMapping(value = "/turn/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter turnStream(@Valid @RequestBody MasterTurnRequest req) {
        SseEmitter emitter = new SseEmitter(60_000L);

        if (req.sessionId == null || req.sessionId.isBlank()) {
            ssePool.submit(() -> {
                try {
                    emitter.send(SseEmitter.event().name("error").data("session_id required"));
                    emitter.complete();
                } catch (IOException e) {
                    log.debug("[Master SSE] Client disconnected before error could be sent: {}", e.getMessage());
                    emitter.completeWithError(e);
                }
            });
            return emitter;
        }

        ssePool.submit(() -> {
            try {
                masterAgent.turnStreaming(
                    req.sessionId,
                    req.input,
                    req.weakWords,
                    req.pronScore,
                    token -> {
                        try {
                            emitter.send(SseEmitter.event().name("token").data(token));
                        } catch (IOException e) {
                            emitter.completeWithError(e);
                        }
                    }
                );
                emitter.send(SseEmitter.event().name("done").data("[END]"));
                emitter.complete();
            } catch (Exception e) {
                log.error("[Master SSE] stream error: {}", e.getMessage());
                try { emitter.send(SseEmitter.event().name("error").data(e.getMessage())); }
                catch (IOException ioEx) {
                    log.debug("[Master SSE] Client disconnected before error event: {}", ioEx.getMessage());
                }
                emitter.completeWithError(e);
            }
        });

        return emitter;
    }

    // ── Stats ─────────────────────────────────────────────────────────────────

    @GetMapping("/session/{sessionId}/stats")
    public ResponseEntity<Map<String, Object>> stats(@PathVariable String sessionId) {
        Map<String, Object> stats = masterAgent.getStats(sessionId);
        return ResponseEntity.ok(stats);
    }
}
