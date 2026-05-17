package com.example.prononciationtest.service;

import com.example.prononciationtest.service.dto.ChatSttResponse;
import com.example.prononciationtest.service.iservice.IChatbotFastApiClient;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

/**
 * HTTP client to Python FastAPI for Whisper STT and edge-TTS only.
 * All LLM logic runs inside Spring Boot (OllamaService / ChatbotAgent).
 */
@Service
public class ChatbotFastApiClient implements IChatbotFastApiClient {

    @Value("${python.base-url:#{'http://localhost:8000'}}")
    private String fastApiUrl;

    private final RestTemplate restTemplate;

    public ChatbotFastApiClient(@Qualifier("chatbotRestTemplate") RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    // ── POST /api/chat/stt ────────────────────────────────────────────────────

    public ChatSttResponse chatStt(MultipartFile audio, String lang) {
        try {
            final byte[] bytes    = audio.getBytes();
            final String filename = audio.getOriginalFilename() != null
                    ? audio.getOriginalFilename() : "recording.webm";

            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            body.add("lang",  lang != null ? lang : "fr");
            body.add("audio", new ByteArrayResource(bytes) {
                @Override public String getFilename() { return filename; }
            });

            ResponseEntity<ChatSttResponse> resp = restTemplate.exchange(
                    fastApiUrl + "/api/chat/stt",
                    HttpMethod.POST,
                    new HttpEntity<>(body, multipartHeaders()),
                    ChatSttResponse.class
            );
            return requireBody(resp, "/api/chat/stt");
        } catch (Exception e) {
            throw new RuntimeException("STT proxy error: " + e.getMessage(), e);
        }
    }

    // ── POST /api/chat/tts ────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    public String chatTts(String text, String lang) {
        try {
            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            body.add("text", text);
            body.add("lang", lang != null ? lang : "fr");

            ResponseEntity<java.util.Map> resp = restTemplate.exchange(
                    fastApiUrl + "/api/chat/tts",
                    HttpMethod.POST,
                    new HttpEntity<>(body, multipartHeaders()),
                    java.util.Map.class
            );
            java.util.Map<?, ?> result = resp.getBody();
            return result != null ? (String) result.get("audio_base64") : "";
        } catch (Exception e) {
            throw new RuntimeException("TTS proxy error: " + e.getMessage(), e);
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static HttpHeaders multipartHeaders() {
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.MULTIPART_FORM_DATA);
        return h;
    }

    private static <T> T requireBody(ResponseEntity<T> resp, String endpoint) {
        if (resp.getBody() == null) {
            throw new RuntimeException("FastAPI returned null for " + endpoint);
        }
        return resp.getBody();
    }
}
