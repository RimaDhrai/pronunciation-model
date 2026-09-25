package com.example.prononciationtest.service.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

/**
 * Service Azure OpenAI — compatible GPT-5.1 (Responses API) et GPT-4.x (Chat Completions API).
 *
 * GPT-5.1 utilise l'API Responses d'Azure AI Foundry :
 *   POST /openai/v1/responses?api-version=2025-04-01-preview
 *   Body  : { "model": "gpt-5.1", "input": [...], "max_output_tokens": N }
 *   Resp  : { "output": [{ "content": [{ "text": "..." }] }] }
 *
 * GPT-4.x utilise l'API Chat Completions standard :
 *   POST /openai/deployments/{deployment}/chat/completions?api-version=...
 *   Body  : { "messages": [...], "max_tokens": N }
 *   Resp  : { "choices": [{ "message": { "content": "..." } }] }
 */
@Service
public class AzureOpenAIService {

    private static final Logger log = LoggerFactory.getLogger(AzureOpenAIService.class);

    private static final String HEADER_API_KEY  = "api-key";
    // Version pour Chat Completions (GPT-4.x) — la Responses API v1 n'utilise pas ce paramètre
    private static final String AZURE_API_VERSION = "2024-08-01-preview";

    private static final String KEY_MESSAGES       = "messages";
    private static final String KEY_MAX_TOKENS     = "max_tokens";
    private static final String KEY_MAX_OUT_TOKENS = "max_output_tokens";
    private static final String KEY_TEMPERATURE    = "temperature";
    private static final String KEY_CONTENT        = "content";
    private static final String KEY_STREAM         = "stream";
    private static final String KEY_INPUT          = "input";
    private static final String KEY_MODEL          = "model";
    private static final String KEY_ROLE           = "role";

    @Value("${azure.openai.path-deployments:/openai/deployments/}")
    private String pathDeployments;

    @Value("${azure.openai.path-completions-version:/chat/completions?api-version=}")
    private String pathCompletionsVersion;

    @Value("${azure.openai.enabled:false}")
    private boolean azureEnabled;

    @Value("${azure.openai.endpoint:}")
    private String azureEndpoint;

    @Value("${azure.openai.key:}")
    private String azureKey;

    // gpt-5.1 — déploiement GlobalStandard sur Azure AI Foundry
    @Value("${azure.openai.deployment:gpt-5.1}")
    private String azureDeployment;

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    public AzureOpenAIService(RestTemplate restTemplate, ObjectMapper objectMapper) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
    }

    public boolean isAzureEnabled() {
        return azureEnabled;
    }

    /** Retourne true si le déploiement utilise l'API Responses (GPT-5.x). */
    private boolean isResponsesApi() {
        return azureDeployment != null && azureDeployment.startsWith("gpt-5");
    }

    // ── Health check ──────────────────────────────────────────────────────────
    public boolean checkHealth() {
        try {
            String url = buildAzureUrl();
            HttpHeaders h = new HttpHeaders();
            h.setContentType(MediaType.APPLICATION_JSON);
            h.set(HEADER_API_KEY, azureKey);

            Map<String, Object> body;
            if (isResponsesApi()) {
                body = Map.of(
                        KEY_MODEL, azureDeployment,
                        KEY_INPUT, "hi",
                        KEY_MAX_OUT_TOKENS, 1);
            } else {
                body = Map.of(
                        KEY_MESSAGES, List.of(Map.of(KEY_ROLE, "user", KEY_CONTENT, "hi")),
                        KEY_MAX_TOKENS, 1);
            }
            restTemplate.exchange(url, HttpMethod.POST, new HttpEntity<>(body, h), String.class);
            return true;
        } catch (Exception e) {
            log.error("Azure OpenAI health check failed", e);
            return false;
        }
    }

    // ── Appel non-streaming ───────────────────────────────────────────────────
    public String callAzureOpenAI(List<Map<String, Object>> messages, int maxTokens, double temperature) {
        try {
            String url = buildAzureUrl();
            Map<String, Object> body = buildRequestBody(messages, maxTokens, temperature, false);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set(HEADER_API_KEY, azureKey);

            ResponseEntity<byte[]> response = restTemplate.exchange(
                    url, HttpMethod.POST, new HttpEntity<>(body, headers), byte[].class);

            if (response.getBody() == null) {
                return "Response unavailable";
            }

            JsonNode json = objectMapper.readTree(response.getBody());
            log.debug("[Azure GPT-5.1] Response JSON: {}", json.toString().substring(0, Math.min(300, json.toString().length())));
            return extractText(json);
        } catch (Exception e) {
            log.error("Azure API request failed: {}", e.getMessage());
            return "Response unavailable: " + e.getMessage();
        }
    }

    // ── Streaming chatbot ─────────────────────────────────────────────────────
    public String streamAzureChatbot(List<Map<String, Object>> messages, Consumer<String> onToken) {
        String url = buildAzureUrl();
        Map<String, Object> body = buildRequestBody(messages, 180, 0.72, true);

        StringBuilder full = new StringBuilder();
        try {
            restTemplate.execute(url, HttpMethod.POST,
                    request -> {
                        request.getHeaders().setContentType(MediaType.APPLICATION_JSON);
                        request.getHeaders().set(HEADER_API_KEY, azureKey);
                        objectMapper.writeValue(request.getBody(), body);
                    },
                    response -> {
                        try (BufferedReader reader = new BufferedReader(
                                new InputStreamReader(response.getBody(), StandardCharsets.UTF_8))) {
                            String line;
                            while ((line = reader.readLine()) != null) {
                                processStreamLine(line, full, onToken);
                            }
                        }
                        return null;
                    });
        } catch (Exception e) {
            log.error("Azure streaming failed: {}", e.getMessage());
            if (full.isEmpty()) {
                return "Response unavailable";
            }
        }
        return full.toString().trim();
    }

    // ── Construction du body ──────────────────────────────────────────────────
    private Map<String, Object> buildRequestBody(
            List<Map<String, Object>> messages, int maxTokens, double temperature, boolean stream) {
        Map<String, Object> body = new LinkedHashMap<>();

        if (isResponsesApi()) {
            // API Responses (GPT-5.x)
            body.put(KEY_MODEL, azureDeployment);
            body.put(KEY_INPUT, convertToInputFormat(messages));
            body.put(KEY_MAX_OUT_TOKENS, maxTokens);
            body.put(KEY_TEMPERATURE, temperature);
            if (stream) {
                body.put(KEY_STREAM, true);
            }
        } else {
            // API Chat Completions (GPT-4.x)
            body.put(KEY_MESSAGES, messages);
            body.put(KEY_MAX_TOKENS, maxTokens);
            body.put(KEY_TEMPERATURE, temperature);
            if (stream) {
                body.put(KEY_STREAM, true);
            }
        }
        return body;
    }

    /**
     * Convertit les messages chat-completions en format "input" de l'API Responses.
     * Le rôle "system" devient "developer" dans la Responses API.
     */
    private List<Map<String, Object>> convertToInputFormat(List<Map<String, Object>> messages) {
        List<Map<String, Object>> inputs = new ArrayList<>();
        for (Map<String, Object> msg : messages) {
            String role    = String.valueOf(msg.getOrDefault(KEY_ROLE, "user"));
            Object content = msg.getOrDefault(KEY_CONTENT, "");
            // "system" → "developer" (convention Responses API)
            String mappedRole = "system".equals(role) ? "developer" : role;
            inputs.add(Map.of(KEY_ROLE, mappedRole, KEY_CONTENT, content));
        }
        return inputs;
    }

    // ── Extraction du texte depuis la réponse ─────────────────────────────────
    private String extractText(JsonNode json) {
        if (isResponsesApi()) {
            // Format Responses API : output[0].content[0].text
            JsonNode outputArr = json.path("output");
            if (outputArr.isArray() && !outputArr.isEmpty()) {
                JsonNode first = outputArr.get(0);
                JsonNode contentArr = first.path(KEY_CONTENT);
                if (contentArr.isArray() && !contentArr.isEmpty()) {
                    String txt = contentArr.get(0).path("text").asText("").trim();
                    if (!txt.isBlank()) return txt;
                }
                // Fallback : "text" direct sur l'output
                String txt = first.path("text").asText("").trim();
                if (!txt.isBlank()) return txt;
            }
        }
        // Format Chat Completions (fallback universel)
        return json.path("choices").path(0).path("message").path(KEY_CONTENT).asText("").trim();
    }

    // ── Traitement d'une ligne SSE (streaming) ────────────────────────────────
    private void processStreamLine(String line, StringBuilder full, Consumer<String> onToken) {
        if (line.isBlank() || "data: [DONE]".equals(line)) return;
        String clean = line.startsWith("data: ") ? line.substring(6) : line;
        try {
            JsonNode node = objectMapper.readTree(clean);
            String token;
            if (isResponsesApi()) {
                // Responses API streaming delta : delta.text ou output_text_delta
                token = node.path("delta").path("text").asText("");
                if (token.isEmpty()) {
                    token = node.path("text").asText("");
                }
            } else {
                token = node.path("choices").path(0).path("delta").path(KEY_CONTENT).asText("");
            }
            if (!token.isEmpty()) {
                full.append(token);
                if (onToken != null) onToken.accept(token);
            }
        } catch (Exception ignored) {
            log.debug("Skipping malformed SSE line: {}", line.substring(0, Math.min(50, line.length())));
        }
    }

    // ── Construction de l'URL ──────────────────────────────────────────────────
    private String buildAzureUrl() {
        String base = azureEndpoint.replaceAll("/$", "");
        if (isResponsesApi()) {
            // GPT-5.1 : Azure AI Foundry Responses API v1 (sans api-version daté)
            return base + "/openai/v1/responses";
        }
        // Standard Chat Completions (GPT-4.x)
        return base + pathDeployments + azureDeployment + pathCompletionsVersion + AZURE_API_VERSION;
    }
}
