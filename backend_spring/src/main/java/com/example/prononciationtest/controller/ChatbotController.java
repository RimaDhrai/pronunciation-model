package com.example.prononciationtest.controller;

import com.example.prononciationtest.agent.ChatbotAgent;
import com.example.prononciationtest.service.SessionMemoryService;
import com.example.prononciationtest.service.dto.ChatSttResponse;
import com.example.prononciationtest.service.iservice.IChatbotFastApiClient;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

/**
 * Chatbot vocal SpeakCoach.
 *
 * Pipeline :
 *   STT  : FastAPI /api/chat/stt  (Whisper)
 *   LLM  : ChatbotAgent (LangGraph4J → OllamaService → Ollama)
 *   TTS  : FastAPI /api/chat/tts  (edge-tts)
 *
 * Session state (lang, level, scenario, history, TTL) is fully managed by ChatbotAgent.
 */
@RestController
@CrossOrigin(origins = "http://localhost:8081")
@RequestMapping("/api/chat")
@Tag(name = "Chatbot", description = "Vocal coach — LangGraph4J agent + Whisper/edge-TTS")
public class ChatbotController {

    private static final Logger log = LoggerFactory.getLogger(ChatbotController.class);

    private final ChatbotAgent          chatbotAgent;
    private final IChatbotFastApiClient chatbotClient;
    private final ObjectMapper          objectMapper;
    private final SessionMemoryService  sessionMemory;

    public ChatbotController(ChatbotAgent chatbotAgent, IChatbotFastApiClient chatbotClient,
                             ObjectMapper objectMapper, SessionMemoryService sessionMemory) {
        this.chatbotAgent  = chatbotAgent;
        this.chatbotClient = chatbotClient;
        this.objectMapper  = objectMapper;
        this.sessionMemory = sessionMemory;
    }

    /** Serialize a Map to a proper JSON string for SSE data fields. */
    private String json(Map<String, Object> data) {
        try { return objectMapper.writeValueAsString(data); }
        catch (Exception e) { return "{}"; }
    }

    /** Strip [RÉPÈTE: "..."] / [REPEAT: "..."] tags before passing text to edge-TTS.
     *  Those tags contain square brackets and quotes that edge-tts may misparse as SSML. */
    private static String stripRepeatTag(String text) {
        if (text == null) return "";
        return text.replaceAll("\\[RÉP[EÈ]TE\\s*:\\s*\"[^\"]*\"\\]", "")
                   .replaceAll("\\[REPEAT\\s*:\\s*\"[^\"]*\"\\]", "")
                   .trim();
    }

    // ═════════════════════════════════════════════════════════════════════════
    // POST /session/start
    // ═════════════════════════════════════════════════════════════════════════

    @PostMapping("/session/start")
    @Operation(summary = "Start a chatbot session")
    public ResponseEntity<?> startSession(
            @RequestParam(defaultValue = "fr") String lang,
            @RequestParam(defaultValue = "B1") String level,
            @RequestParam(defaultValue = "") String scenario,
            @RequestParam(name = "master_session_id", required = false) String masterSessionId
    ) {
        try {
            String sessionId = UUID.randomUUID().toString();
            String greeting = chatbotAgent.startSession(sessionId, lang, level, scenario);

            // Report chat session start to MasterAgent memory
            if (masterSessionId != null && !masterSessionId.isBlank()
                    && sessionMemory.exists(masterSessionId)) {
                sessionMemory.incrementChatRound(masterSessionId);
            }

            String audioB64 = "";
            try { audioB64 = chatbotClient.chatTts(stripRepeatTag(greeting), lang); }
            catch (Exception e) { log.warn("[Chatbot] TTS greeting failed: {}", e.getMessage()); }

            Map<String, Object> resp = new LinkedHashMap<>();
            resp.put("session_id", sessionId);
            resp.put("greeting", greeting);
            resp.put("audio_base64", audioB64 != null ? audioB64 : "");
            resp.put("audio_format", "mp3");
            resp.put("lang", lang);
            resp.put("level", level);
            resp.put("scenario", scenario);
            return ResponseEntity.ok(resp);

        } catch (Exception e) {
            log.error("[Chatbot] startSession error: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // POST /voice (avec streaming)
    // ═════════════════════════════════════════════════════════════════════════

    @PostMapping("/voice")
    @Operation(summary = "Send a voice message to the coach (with streaming)")
    public ResponseEntity<?> sendVoice(
            @RequestParam("session_id") String sessionId,
            @RequestParam MultipartFile audio,
            @RequestParam(name = "native_lang", defaultValue = "fr") String nativeLang,
            @RequestParam(name = "stream", defaultValue = "true") boolean stream
    ) {
        try {
            if (!chatbotAgent.sessionExists(sessionId)) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "Session introuvable ou expirée", "retry", false));
            }

            // 1 ── STT via FastAPI (Whisper)
            ChatSttResponse stt = chatbotClient.chatStt(audio, nativeLang);
            if (stt.hasError()) {
                return ResponseEntity.ok(Map.of(
                        "error", stt.getError() != null ? stt.getError() : "STT failed",
                        "retry", Boolean.TRUE.equals(stt.getRetry())
                ));
            }

            String userText = stt.getCleanText() != null ? stt.getCleanText() : "";
            List<String> weakWords = stt.getWeakWords() != null ? stt.getWeakWords() : List.of();
            double avgConf = stt.getAvgConfidence() != null ? stt.getAvgConfidence() : 1.0;

            log.info("[Chatbot] {} | '{}' | weak={} | conf={}",
                    sessionId.substring(0, 8),
                    userText.length() > 60 ? userText.substring(0, 60) + "…" : userText,
                    weakWords, String.format("%.2f", avgConf));

            // 2 ── LLM via ChatbotAgent
            String coachReply;
            if (stream) {
                // Version streaming - réponse progressive
                coachReply = chatbotAgent.chat(sessionId, userText, weakWords, avgConf);
            } else {
                coachReply = chatbotAgent.chat(sessionId, userText, weakWords, avgConf);
            }

            // 3 ── TTS via FastAPI (edge-tts)
            String audioB64 = "";
            try { audioB64 = chatbotClient.chatTts(stripRepeatTag(coachReply), nativeLang); }
            catch (Exception e) { log.warn("[Chatbot] TTS failed: {}", e.getMessage()); }

            Map<String, Object> resp = new LinkedHashMap<>();
            resp.put("session_id", sessionId);
            resp.put("user_transcript", userText);
            resp.put("weak_words", weakWords);
            resp.put("avg_confidence", Math.round(avgConf * 1000.0) / 1000.0);
            resp.put("pron_score", stt.getPronScore());
            resp.put("pron_feedback", stt.getPronFeedback());
            resp.put("coach_response", coachReply);
            resp.put("audio_base64", audioB64 != null ? audioB64 : "");
            resp.put("audio_format", "mp3");
            return ResponseEntity.ok(resp);

        } catch (Exception e) {
            log.error("[Chatbot] voice error: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // GET /voice/stream (Server-Sent Events pour réponse progressive)
    // ═════════════════════════════════════════════════════════════════════════

    @GetMapping(value = "/voice/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @Operation(summary = "Send voice with streaming response (SSE)")
    public SseEmitter sendVoiceStream(
            @RequestParam("session_id") String sessionId,
            @RequestParam MultipartFile audio,
            @RequestParam(name = "native_lang", defaultValue = "fr") String nativeLang
    ) {
        SseEmitter emitter = new SseEmitter(30000L); // 30s timeout

        CompletableFuture.runAsync(() -> {
            try {
                if (!chatbotAgent.sessionExists(sessionId)) {
                    emitter.send(SseEmitter.event().name("error").data(Map.of("error", "Session expirée")));
                    emitter.complete();
                    return;
                }

                // 1 ── STT
                emitter.send(SseEmitter.event().name("status").data(Map.of("step", "stt", "message", "Transcription en cours...")));

                ChatSttResponse stt = chatbotClient.chatStt(audio, nativeLang);
                if (stt.hasError()) {
                    emitter.send(SseEmitter.event().name("error").data(Map.of("error", stt.getError())));
                    emitter.complete();
                    return;
                }

                String userText = stt.getCleanText() != null ? stt.getCleanText() : "";
                List<String> weakWords = stt.getWeakWords() != null ? stt.getWeakWords() : List.of();
                double avgConf = stt.getAvgConfidence() != null ? stt.getAvgConfidence() : 1.0;

                emitter.send(SseEmitter.event().name("transcript").data(Map.of(
                        "text", userText,
                        "weak_words", weakWords,
                        "confidence", avgConf
                )));

                // 2 ── LLM avec streaming
                emitter.send(SseEmitter.event().name("status").data(Map.of("step", "llm", "message", "Génération de la réponse...")));

                chatbotAgent.chatStreaming(sessionId, userText, weakWords, avgConf, token -> {
                    try {
                        emitter.send(SseEmitter.event().name("token").data(Map.of("text", token)));
                    } catch (IOException e) {
                        log.error("Stream error: {}", e.getMessage());
                    }
                }).thenAccept(response -> {
                    try {
                        // 3 ── TTS
                        emitter.send(SseEmitter.event().name("status").data(Map.of("step", "tts", "message", "Synthèse vocale...")));

                        String audioB64 = chatbotClient.chatTts(stripRepeatTag(response), nativeLang);
                        emitter.send(SseEmitter.event().name("complete").data(Map.of(
                                "response", response,
                                "audio_base64", audioB64 != null ? audioB64 : "",
                                "audio_format", "mp3"
                        )));
                        emitter.complete();
                    } catch (Exception e) {
                        try { emitter.send(SseEmitter.event().name("error").data(Map.of("error", e.getMessage()))); } catch (IOException ignored) {}
                        emitter.complete();
                    }
                }).exceptionally(e -> {
                    try { emitter.send(SseEmitter.event().name("error").data(Map.of("error", e.getMessage()))); } catch (IOException ignored) {}
                    emitter.complete();
                    return null;
                });

            } catch (Exception e) {
                try { emitter.send(SseEmitter.event().name("error").data(Map.of("error", e.getMessage()))); } catch (IOException ignored) {}
                emitter.complete();
            }
        });

        return emitter;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // POST /text (avec option streaming)
    // ═════════════════════════════════════════════════════════════════════════

    @PostMapping("/text")
    @Operation(summary = "Send a text message to the coach")
    public ResponseEntity<?> sendText(
            @RequestParam("session_id") String sessionId,
            @RequestParam String message,
            @RequestParam(defaultValue = "fr") String lang,
            @RequestParam(name = "stream", defaultValue = "false") boolean stream
    ) {
        try {
            if (!chatbotAgent.sessionExists(sessionId)) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "Session introuvable ou expirée"));
            }

            String coachReply = chatbotAgent.chat(sessionId, message, List.of(), null);

            String audioB64 = "";
            try { audioB64 = chatbotClient.chatTts(stripRepeatTag(coachReply), lang); }
            catch (Exception e) { log.warn("[Chatbot] TTS failed: {}", e.getMessage()); }

            Map<String, Object> resp = new LinkedHashMap<>();
            resp.put("session_id", sessionId);
            resp.put("coach_response", coachReply);
            resp.put("audio_base64", audioB64 != null ? audioB64 : "");
            resp.put("audio_format", "mp3");
            return ResponseEntity.ok(resp);

        } catch (Exception e) {
            log.error("[Chatbot] text error: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // GET /text/stream (SSE pour text message)
    // ═════════════════════════════════════════════════════════════════════════

    @GetMapping(value = "/text/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @Operation(summary = "Send text with streaming response (SSE)")
    public SseEmitter sendTextStream(
            @RequestParam("session_id") String sessionId,
            @RequestParam String message
    ) {
        SseEmitter emitter = new SseEmitter(30000L);

        CompletableFuture.runAsync(() -> {
            try {
                if (!chatbotAgent.sessionExists(sessionId)) {
                    emitter.send(SseEmitter.event().name("error").data(Map.of("error", "Session expirée")));
                    emitter.complete();
                    return;
                }

                emitter.send(SseEmitter.event().name("status").data(Map.of("step", "llm", "message", "Génération de la réponse...")));

                chatbotAgent.chatStreaming(sessionId, message, List.of(), null, token -> {
                    try {
                        emitter.send(SseEmitter.event().name("token").data(Map.of("text", token)));
                    } catch (IOException e) {
                        log.error("Stream error: {}", e.getMessage());
                    }
                }).thenAccept(response -> {
                    try {
                        String audioB64 = chatbotClient.chatTts(stripRepeatTag(response), "fr");
                        emitter.send(SseEmitter.event().name("complete").data(Map.of(
                                "response", response,
                                "audio_base64", audioB64 != null ? audioB64 : "",
                                "audio_format", "mp3"
                        )));
                        emitter.complete();
                    } catch (Exception e) {
                        try { emitter.send(SseEmitter.event().name("error").data(Map.of("error", e.getMessage()))); } catch (IOException ignored) {}
                        emitter.complete();
                    }
                }).exceptionally(e -> {
                    try { emitter.send(SseEmitter.event().name("error").data(Map.of("error", e.getMessage()))); } catch (IOException ignored) {}
                    emitter.complete();
                    return null;
                });

            } catch (Exception e) {
                try { emitter.send(SseEmitter.event().name("error").data(Map.of("error", e.getMessage()))); } catch (IOException ignored) {}
                emitter.complete();
            }
        });

        return emitter;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // POST /voice-sse  (multipart + SSE — replaces the GET /voice/stream)
    // ═════════════════════════════════════════════════════════════════════════

    @PostMapping(value = "/voice-sse", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @Operation(summary = "Send voice with real Ollama streaming (SSE, POST)")
    public SseEmitter sendVoiceSse(
            @RequestParam("session_id") String sessionId,
            @RequestParam MultipartFile audio,
            @RequestParam(name = "native_lang", defaultValue = "fr") String nativeLang,
            @RequestParam(name = "master_session_id", required = false) String masterSessionId
    ) {
        SseEmitter emitter = new SseEmitter(120000L);
        emitter.onTimeout(() -> {
            try { emitter.send(SseEmitter.event().name("error").data(json(Map.of("error", "Timeout — réessaie")))); } catch (IOException ignored) {}
            emitter.complete();
        });
        emitter.onError(ex -> emitter.complete());

        CompletableFuture.runAsync(() -> {
            try {
                if (!chatbotAgent.sessionExists(sessionId)) {
                    emitter.send(SseEmitter.event().name("error").data(json(Map.of("error", "Session expirée"))));
                    emitter.complete();
                    return;
                }

                // 1 ── STT
                ChatSttResponse stt = chatbotClient.chatStt(audio, nativeLang);
                if (stt.hasError()) {
                    emitter.send(SseEmitter.event().name("error").data(json(Map.of("error", stt.getError() != null ? stt.getError() : "STT error"))));
                    emitter.complete();
                    return;
                }

                String userText    = stt.getCleanText()    != null ? stt.getCleanText()    : "";
                List<String> weakWords = stt.getWeakWords() != null ? stt.getWeakWords()   : List.of();
                double avgConf     = stt.getAvgConfidence() != null ? stt.getAvgConfidence(): 1.0;

                Map<String, Object> transcriptData = new LinkedHashMap<>();
                transcriptData.put("text",       userText);
                transcriptData.put("weak_words", weakWords);
                transcriptData.put("confidence", avgConf);
                emitter.send(SseEmitter.event().name("transcript").data(json(transcriptData)));

                // 2 ── LLM streaming — each token forwarded immediately
                chatbotAgent.chatStreaming(sessionId, userText, weakWords, avgConf, token -> {
                    try { emitter.send(SseEmitter.event().name("token").data(json(Map.of("text", token)))); }
                    catch (IOException ignored) {}
                }).thenAccept(response -> {
                    try {
                        // 3 ── TTS
                        String audioB64 = "";
                        try { audioB64 = chatbotClient.chatTts(stripRepeatTag(response), nativeLang); }
                        catch (Exception ex) { log.warn("[Chatbot] TTS failed: {}", ex.getMessage()); }

                        Map<String, Object> completeData = new LinkedHashMap<>();
                        completeData.put("response",     response);
                        completeData.put("audio_base64", audioB64 != null ? audioB64 : "");
                        completeData.put("audio_format", "mp3");
                        completeData.put("pron_score",   stt.getPronScore()    != null ? stt.getPronScore()    : -1);
                        completeData.put("pron_feedback",stt.getPronFeedback() != null ? stt.getPronFeedback() : "");
                        emitter.send(SseEmitter.event().name("complete").data(json(completeData)));
                        emitter.complete();

                        // 4 ── Report weak words to MasterAgent memory (fire-and-forget)
                        if (masterSessionId != null && !masterSessionId.isBlank()
                                && !weakWords.isEmpty() && sessionMemory.exists(masterSessionId)) {
                            sessionMemory.addWeakWords(masterSessionId, weakWords);
                        }
                    } catch (Exception ex) {
                        try { emitter.send(SseEmitter.event().name("error").data(json(Map.of("error", "Server error")))); } catch (IOException ignored) {}
                        emitter.complete();
                    }
                }).exceptionally(ex -> {
                    Throwable cause = ex instanceof java.util.concurrent.CompletionException ? ex.getCause() : ex;
                    String errMsg = cause instanceof java.util.concurrent.TimeoutException ? "TIMEOUT" : "Server error";
                    try { emitter.send(SseEmitter.event().name("error").data(json(Map.of("error", errMsg)))); } catch (IOException ignored) {}
                    emitter.complete();
                    return null;
                });

            } catch (Exception e) {
                try { emitter.send(SseEmitter.event().name("error").data(json(Map.of("error", e.getMessage())))); } catch (IOException ignored) {}
                emitter.complete();
            }
        });

        return emitter;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // POST /text-sse  (text message + SSE)
    // ═════════════════════════════════════════════════════════════════════════

    @PostMapping(value = "/text-sse", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @Operation(summary = "Send text with real Ollama streaming (SSE, POST)")
    public SseEmitter sendTextSse(
            @RequestParam("session_id") String sessionId,
            @RequestParam String message,
            @RequestParam(defaultValue = "fr") String lang,
            @RequestParam(name = "master_session_id", required = false) String masterSessionId
    ) {
        SseEmitter emitter = new SseEmitter(60000L);

        CompletableFuture.runAsync(() -> {
            try {
                if (!chatbotAgent.sessionExists(sessionId)) {
                    emitter.send(SseEmitter.event().name("error").data(json(Map.of("error", "Session expirée"))));
                    emitter.complete();
                    return;
                }

                chatbotAgent.chatStreaming(sessionId, message, List.of(), null, token -> {
                    try { emitter.send(SseEmitter.event().name("token").data(json(Map.of("text", token)))); }
                    catch (IOException ignored) {}
                }).thenAccept(response -> {
                    try {
                        String audioB64 = "";
                        try { audioB64 = chatbotClient.chatTts(stripRepeatTag(response), lang); }
                        catch (Exception ex) { log.warn("[Chatbot] TTS failed: {}", ex.getMessage()); }

                        Map<String, Object> completeData = new LinkedHashMap<>();
                        completeData.put("response",     response);
                        completeData.put("audio_base64", audioB64 != null ? audioB64 : "");
                        completeData.put("audio_format", "mp3");
                        emitter.send(SseEmitter.event().name("complete").data(json(completeData)));
                        emitter.complete();

                        // Report turn count to MasterAgent memory (fire-and-forget)
                        if (masterSessionId != null && !masterSessionId.isBlank()
                                && sessionMemory.exists(masterSessionId)) {
                            sessionMemory.incrementChatRound(masterSessionId);
                        }
                    } catch (Exception ex) {
                        try { emitter.send(SseEmitter.event().name("error").data(json(Map.of("error", "Server error")))); } catch (IOException ignored) {}
                        emitter.complete();
                    }
                }).exceptionally(ex -> {
                    Throwable cause = ex instanceof java.util.concurrent.CompletionException ? ex.getCause() : ex;
                    String errMsg = cause instanceof java.util.concurrent.TimeoutException ? "TIMEOUT" : "Server error";
                    try { emitter.send(SseEmitter.event().name("error").data(json(Map.of("error", errMsg)))); } catch (IOException ignored) {}
                    emitter.complete();
                    return null;
                });

            } catch (Exception e) {
                try { emitter.send(SseEmitter.event().name("error").data(json(Map.of("error", e.getMessage())))); } catch (IOException ignored) {}
                emitter.complete();
            }
        });

        return emitter;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // GET /history
    // ═════════════════════════════════════════════════════════════════════════

    @GetMapping("/history")
    @Operation(summary = "Get full conversation history for the current session")
    public ResponseEntity<?> getHistory(@RequestParam("session_id") String sessionId) {
        if (!chatbotAgent.sessionExists(sessionId)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "Session introuvable ou expirée"));
        }
        List<Map<String, String>> history = chatbotAgent.getHistory(sessionId);
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("session_id", sessionId);
        resp.put("history", history);
        resp.put("count", history.size());
        return ResponseEntity.ok(resp);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // GET /quick (ultra-rapide sans LLM)
    // ═════════════════════════════════════════════════════════════════════════

    @GetMapping("/quick")
    @Operation(summary = "Ultra-fast answer (cache only, no LLM)")
    public ResponseEntity<?> quickAnswer(@RequestParam String message) {
        String response = chatbotAgent.chatFast(null, message);
        return ResponseEntity.ok(Map.of("response", response));
    }

    // ═════════════════════════════════════════════════════════════════════════
    // DELETE /session/{sessionId}
    // ═════════════════════════════════════════════════════════════════════════

    @DeleteMapping("/session/{sessionId}")
    @Operation(summary = "End a chatbot session")
    public ResponseEntity<Void> endSession(@PathVariable String sessionId) {
        chatbotAgent.endSession(sessionId);
        return ResponseEntity.ok().build();
    }

    // ═════════════════════════════════════════════════════════════════════════
    // GET /ping (health check)
    // ═════════════════════════════════════════════════════════════════════════

    @GetMapping("/ping")
    @Operation(summary = "Health check")
    public ResponseEntity<?> ping() {
        return ResponseEntity.ok(Map.of("status", "alive", "timestamp", System.currentTimeMillis()));
    }
}