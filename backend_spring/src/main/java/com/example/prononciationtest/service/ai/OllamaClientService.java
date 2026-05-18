package com.example.prononciationtest.service.ai;

import com.example.prononciationtest.service.PhraseTaxonomy;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.http.*;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class OllamaClientService {

    private static final Logger log = LoggerFactory.getLogger(OllamaClientService.class);

    private static final String KEY_SCORE = "score";
    private static final String KEY_STREAM = "stream";
    private static final String KEY_TEMPERATURE = "temperature";
    private static final String KEY_MESSAGES = "messages";
    private static final String KEY_MESSAGE = "message";
    private static final String KEY_CONTENT = "content";

    @Value("${ollama.base-url:#{'http://localhost:11434'}}")
    private String ollamaBaseUrl;

    @Value("${ollama.model:#{'qwen2.5:3b'}}")
    private String ollamaModel;

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final PhraseTaxonomy taxonomy;
    private final AzureOpenAIService azureOpenAIService;

    public OllamaClientService(RestTemplate restTemplate, 
                               ObjectMapper objectMapper, 
                               PhraseTaxonomy taxonomy,
                               AzureOpenAIService azureOpenAIService) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
        this.taxonomy = taxonomy;
        this.azureOpenAIService = azureOpenAIService;
    }

    @Async
    @EventListener(ApplicationReadyEvent.class)
    public void warmupOllama() {
        if (azureOpenAIService.isAzureEnabled()) {
            log.info("[Azure OpenAI] enabled - skipping Ollama warmup.");
            return;
        }
        try {
            callOllama("You are a helpful assistant.", "Hi", 1, 0.0);
            log.info("[Ollama] Warmup OK - model loaded in memory.");
        } catch (Exception e) {
            log.warn("[Ollama] Warmup skipped (Ollama not started): {}", e.getMessage());
        }
    }

    public String getOllamaModel() {
        return ollamaModel;
    }

    public String getOllamaBaseUrl() {
        return ollamaBaseUrl;
    }

    public String callOllama(String system, String userPrompt, int maxTokens, double temperature) {
        List<Map<String, Object>> messages = system.isBlank()
                ? List.of(Map.of("role", "user", KEY_CONTENT, userPrompt))
                : List.of(
                        Map.of("role", "system", "content", system),
                        Map.of("role", "user", KEY_CONTENT, userPrompt));
        return callOllamaMessages(ollamaModel, messages, maxTokens, temperature);
    }

    public String callOllamaMessages(String model, List<Map<String, Object>> messages,
            int maxTokens, double temperature) {
        return callOllamaMessages(model, messages, maxTokens, temperature, 1024);
    }

    public String callOllamaMessages(String model, List<Map<String, Object>> messages,
            int maxTokens, double temperature, int numCtx) {
        if (azureOpenAIService.isAzureEnabled()) {
            return azureOpenAIService.callAzureOpenAI(messages, maxTokens, temperature);
        }
        try {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("model", model);
            body.put(KEY_STREAM, false);
            body.put("options", Map.of(KEY_TEMPERATURE, temperature, "num_predict", maxTokens, "num_ctx", numCtx));
            body.put(KEY_MESSAGES, messages);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            ResponseEntity<byte[]> response = restTemplate.exchange(
                    ollamaBaseUrl + "/api/chat",
                    HttpMethod.POST,
                    new HttpEntity<>(body, headers),
                    byte[].class);
            
            if (response == null || response.getBody() == null) {
                return "Response unavailable";
            }
            
            JsonNode json = objectMapper.readTree(response.getBody());
            return json.path(KEY_MESSAGE).path(KEY_CONTENT).asText("").trim();
        } catch (Exception e) {
            log.error("Ollama API request failed", e);
            return "\u26A0\uFE0F R\u00e9ponse indisponible : " + e.getMessage();
        }
    }

    public String callRaw(String system, String userPrompt, int maxTokens, double temperature, String expectedLang) {
        String raw = callOllama(system, userPrompt, maxTokens, temperature);
        String cleaned = raw.split("\n")[0].trim()
                .replaceAll("^[\\\"'\\u00AB\\u00BB\\-*#\\u2022\\d.)+\\s]+", "")
                .replaceAll("[\\\"'\\u00AB\\u00BB]+$", "")
                .trim();
        return taxonomy.isHallucination(cleaned, expectedLang) ? null : cleaned;
    }

    public boolean isHealthy() {
        if (azureOpenAIService.isAzureEnabled()) {
            return azureOpenAIService.checkHealth();
        }
        try {
            ResponseEntity<String> response = restTemplate.getForEntity(ollamaBaseUrl + "/api/tags", String.class);
            return response.getStatusCode().is2xxSuccessful();
        } catch (Exception e) {
            log.error("Ollama health check failed", e);
            return false;
        }
    }
}
