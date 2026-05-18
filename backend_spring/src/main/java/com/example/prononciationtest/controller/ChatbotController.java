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
    private static final String KEY_ERROR = "error";
    private static final String MSG_SESSION_EXPIRED = "Session expirée";
    private static final String MSG_SESSION_NOT_FOUND = "Session introuvable ou expirée";
    private static final String MSG_SERVER_ERROR = "Server error";
    private static final String KEY_RESPONSE = "response";
    private static final String MSG_TIMEOUT = "Timeout — réessaie";

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

    
    /** Send an SSE error event and complete the emitter. Swallows IOException (client already gone). */
    private void sseError(SseEmitter emitter, String message) {
        try { emitter.send(SseEmitter.event().name(KEY_ERROR).data(json(Map.of(KEY_ERROR, message)))); }
        catch (IOException ex) { log.debug("SSE error-write failed (client gone): {}", ex.getMessage()); }
        emitter.complete();
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
                    .body(Map.of(KEY_ERROR, e.getMessage()));
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
                        .body(Map.of(KEY_ERROR, MSG_SESSION_NOT_FOUND, "retry", false));
            }

            // 1 ── STT via FastAPI (Whisper)
            ChatSttResponse stt = chatbotClient.chatStt(audio, nativeLang);
            if (stt.hasError()) {
                return ResponseEntity.ok(Map.of(
                        KEY_ERROR, stt.getError() != null ? stt.getError() : "STT failed",
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
                    .body(Map.of(KEY_ERROR, e.getMessage()));
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
        emitter.onTimeout(() -> sseError(emitter, MSG_TIMEOUT));
        emitter.onError(ex -> emitter.complete());
        handleVoiceStream(emitter, sessionId, audio, nativeLang, null, true);
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
                        .body(Map.of(KEY_ERROR, MSG_SESSION_NOT_FOUND));
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
                    .body(Map.of(KEY_ERROR, e.getMessage()));
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
        emitter.onTimeout(() -> sseError(emitter, MSG_TIMEOUT));
        emitter.onError(ex -> emitter.complete());
        handleTextStream(emitter, sessionId, message, "fr", null, true);
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
        emitter.onTimeout(() -> sseError(emitter, MSG_TIMEOUT));
        emitter.onError(ex -> emitter.complete());
        handleVoiceStream(emitter, sessionId, audio, nativeLang, masterSessionId, false);
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
        emitter.onTimeout(() -> sseError(emitter, MSG_TIMEOUT));
        emitter.onError(ex -> emitter.complete());
        handleTextStream(emitter, sessionId, message, lang, masterSessionId, false);
        return emitter;
    }


    // ── Common Streaming Logic Helpers ───────────────────────────────────────

    private String synthesizeTts(String text, String lang) {
        try {
            return chatbotClient.chatTts(stripRepeatTag(text), lang);
        } catch (Exception ex) {
            log.warn("[Chatbot] TTS failed: {}", ex.getMessage());
            return "";
        }
    }

    private void sendVoiceComplete(SseEmitter emitter, String response, String audioB64, ChatSttResponse stt, String masterSessionId, List<String> weakWords) throws IOException {
        Map<String, Object> completeData = new LinkedHashMap<>();
        completeData.put(KEY_RESPONSE, response);
        completeData.put("audio_base64", audioB64);
        completeData.put("audio_format", "mp3");
        completeData.put("pron_score", stt.getPronScore() != null ? stt.getPronScore() : -1);
        completeData.put("pron_feedback", stt.getPronFeedback() != null ? stt.getPronFeedback() : "");
        emitter.send(SseEmitter.event().name("complete").data(json(completeData)));
        emitter.complete();

        if (masterSessionId != null && !masterSessionId.isBlank()
                && !weakWords.isEmpty() && sessionMemory.exists(masterSessionId)) {
            sessionMemory.addWeakWords(masterSessionId, weakWords);
        }
    }

    private void handleVoiceStream(
            SseEmitter emitter,
            String sessionId,
            MultipartFile audio,
            String nativeLang,
            String masterSessionId,
            boolean sendStatusEvents
    ) {
        CompletableFuture.runAsync(() -> doHandleVoiceStream(emitter, sessionId, audio, nativeLang, masterSessionId, sendStatusEvents));
    }

    private void doHandleVoiceStream(
            SseEmitter emitter,
            String sessionId,
            MultipartFile audio,
            String nativeLang,
            String masterSessionId,
            boolean sendStatusEvents
    ) {
        try {
            if (!chatbotAgent.sessionExists(sessionId)) {
                sseError(emitter, MSG_SESSION_EXPIRED);
                return;
            }

            if (sendStatusEvents) {
                sendStepStatus(emitter, "stt", "Transcription en cours...");
            }

            ChatSttResponse stt = chatbotClient.chatStt(audio, nativeLang);
            if (stt.hasError()) {
                String sttError = stt.getError() != null ? stt.getError() : "STT error";
                sseError(emitter, sttError);
                return;
            }

            String userText = stt.getCleanText() != null ? stt.getCleanText() : "";
            List<String> weakWords = stt.getWeakWords() != null ? stt.getWeakWords() : List.of();
            double avgConf = stt.getAvgConfidence() != null ? stt.getAvgConfidence() : 1.0;

            sendTranscript(emitter, userText, weakWords, avgConf);

            if (sendStatusEvents) {
                sendStepStatus(emitter, "llm", "Génération de la réponse...");
            }

            chatbotAgent.chatStreaming(sessionId, userText, weakWords, avgConf, token -> sendToken(emitter, token))
                .thenAccept(response -> handleVoiceStreamingSuccess(emitter, response, nativeLang, stt, masterSessionId, weakWords, sendStatusEvents))
                .exceptionally(ex -> handleStreamingException(emitter, ex));

        } catch (Exception e) {
            sseError(emitter, e.getMessage());
        }
    }

    private void sendTextComplete(SseEmitter emitter, String response, String audioB64, String masterSessionId) throws IOException {
        emitter.send(SseEmitter.event().name("complete").data(json(Map.of(
                KEY_RESPONSE, response,
                "audio_base64", audioB64,
                "audio_format", "mp3"
        ))));
        emitter.complete();

        if (masterSessionId != null && !masterSessionId.isBlank()
                && sessionMemory.exists(masterSessionId)) {
            sessionMemory.incrementChatRound(masterSessionId);
        }
    }

    private void handleTextStream(
            SseEmitter emitter,
            String sessionId,
            String message,
            String lang,
            String masterSessionId,
            boolean sendStatusEvents
    ) {
        CompletableFuture.runAsync(() -> doHandleTextStream(emitter, sessionId, message, lang, masterSessionId, sendStatusEvents));
    }

    private void doHandleTextStream(
            SseEmitter emitter,
            String sessionId,
            String message,
            String lang,
            String masterSessionId,
            boolean sendStatusEvents
    ) {
        try {
            if (!chatbotAgent.sessionExists(sessionId)) {
                sseError(emitter, MSG_SESSION_EXPIRED);
                return;
            }

            if (sendStatusEvents) {
                sendStepStatus(emitter, "llm", "Génération de la réponse...");
            }

            chatbotAgent.chatStreaming(sessionId, message, List.of(), null, token -> sendToken(emitter, token))
                .thenAccept(response -> handleTextStreamingSuccess(emitter, response, lang, masterSessionId))
                .exceptionally(ex -> handleStreamingException(emitter, ex));

        } catch (Exception e) {
            sseError(emitter, e.getMessage());
        }
    }

    // ── Helper Methods to Reduce Cognitive Complexity ────────────────────────

    private void sendStepStatus(SseEmitter emitter, String step, String message) throws IOException {
        emitter.send(SseEmitter.event().name("status").data(Map.of("step", step, "message", message)));
    }

    private void sendToken(SseEmitter emitter, String token) {
        try {
            emitter.send(SseEmitter.event().name("token").data(json(Map.of("text", token))));
        } catch (IOException ex) {
            log.debug("SSE write failed: {}", ex.getMessage());
        }
    }

    private void sendTranscript(SseEmitter emitter, String text, List<String> weakWords, double confidence) throws IOException {
        emitter.send(SseEmitter.event().name("transcript").data(json(Map.of(
                "text", text,
                "weak_words", weakWords,
                "confidence", confidence
        ))));
    }

    private void handleVoiceStreamingSuccess(
            SseEmitter emitter,
            String response,
            String nativeLang,
            ChatSttResponse stt,
            String masterSessionId,
            List<String> weakWords,
            boolean sendStatusEvents
    ) {
        try {
            if (sendStatusEvents) {
                sendStepStatus(emitter, "tts", "Synthèse vocale...");
            }
            String audioB64 = synthesizeTts(response, nativeLang);
            sendVoiceComplete(emitter, response, audioB64, stt, masterSessionId, weakWords);
        } catch (Exception ex) {
            sseError(emitter, MSG_SERVER_ERROR);
        }
    }

    private void handleTextStreamingSuccess(SseEmitter emitter, String response, String lang, String masterSessionId) {
        try {
            String audioB64 = synthesizeTts(response, lang);
            sendTextComplete(emitter, response, audioB64, masterSessionId);
        } catch (Exception ex) {
            sseError(emitter, MSG_SERVER_ERROR);
        }
    }

    private Void handleStreamingException(SseEmitter emitter, Throwable ex) {
        Throwable cause = ex instanceof java.util.concurrent.CompletionException ? ex.getCause() : ex;
        String errMsg = cause instanceof java.util.concurrent.TimeoutException ? "TIMEOUT" : MSG_SERVER_ERROR;
        sseError(emitter, errMsg);
        return null;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // GET /history
    // ═════════════════════════════════════════════════════════════════════════

    @GetMapping("/history")
    @Operation(summary = "Get full conversation history for the current session")
    public ResponseEntity<?> getHistory(@RequestParam("session_id") String sessionId) {
        if (!chatbotAgent.sessionExists(sessionId)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of(KEY_ERROR, MSG_SESSION_NOT_FOUND));
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
        return ResponseEntity.ok(Map.of(KEY_RESPONSE, response));
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