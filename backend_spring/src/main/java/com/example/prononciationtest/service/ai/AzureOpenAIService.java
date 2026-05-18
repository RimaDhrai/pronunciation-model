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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

@Service
public class AzureOpenAIService {

    private static final Logger log = LoggerFactory.getLogger(AzureOpenAIService.class);

    private static final String PATH_DEPLOYMENTS = "/openai/deployments/";
    private static final String PATH_COMPLETIONS_VERSION = "/chat/completions?api-version=";
    private static final String HEADER_API_KEY = "api-key";
    private static final String AZURE_API_VERSION = "2025-01-01-preview";
    
    private static final String KEY_MESSAGES = "messages";
    private static final String KEY_MAX_TOKENS = "max_tokens";
    private static final String KEY_TEMPERATURE = "temperature";
    private static final String KEY_CONTENT = "content";
    private static final String KEY_STREAM = "stream";

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

    @Value("${azure.openai.deployment:gpt-4.1-mini}")
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

    public boolean checkHealth() {
        try {
            String url = buildAzureUrl();
            HttpHeaders h = new HttpHeaders();
            h.setContentType(MediaType.APPLICATION_JSON);
            h.set(HEADER_API_KEY, azureKey);
            Map<String, Object> body = Map.of(
                    KEY_MESSAGES, List.of(Map.of("role", "user", KEY_CONTENT, "hi")),
                    KEY_MAX_TOKENS, 1);
            restTemplate.exchange(url, HttpMethod.POST, new HttpEntity<>(body, h), String.class);
            return true;
        } catch (Exception e) {
            log.error("Azure OpenAI health check failed", e);
            return false;
        }
    }

    public String callAzureOpenAI(List<Map<String, Object>> messages, int maxTokens, double temperature) {
        try {
            String url = buildAzureUrl();
            Map<String, Object> body = new LinkedHashMap<>();
            body.put(KEY_MESSAGES, messages);
            body.put(KEY_MAX_TOKENS, maxTokens);
            body.put(KEY_TEMPERATURE, temperature);
            
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set(HEADER_API_KEY, azureKey);
            
            ResponseEntity<byte[]> response = restTemplate.exchange(
                    url, HttpMethod.POST, new HttpEntity<>(body, headers), byte[].class);
            
            if (response.getBody() == null) {
                return "Response unavailable";
            }
            
            JsonNode json = objectMapper.readTree(response.getBody());
            return json.path("choices").path(0).path("message").path(KEY_CONTENT).asText("").trim();
        } catch (Exception e) {
            log.error("Azure API request failed", e);
            return "Response unavailable: " + e.getMessage();
        }
    }

    public String streamAzureChatbot(List<Map<String, Object>> messages, Consumer<String> onToken) {
        String url = buildAzureUrl();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put(KEY_MESSAGES, messages);
        body.put(KEY_MAX_TOKENS, 110);
        body.put(KEY_TEMPERATURE, 0.72);
        body.put(KEY_STREAM, true);
        
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
                                processAzureStreamLine(line, full, onToken);
                            }
                        }
                        return null;
                    });
        } catch (Exception e) {
            log.error("Azure streaming failed", e);
            if (full.isEmpty()) {
                return "Response unavailable";
            }
        }
        return full.toString().trim();
    }

    private void processAzureStreamLine(String line, StringBuilder full, Consumer<String> onToken) {
        if (line.isBlank() || line.equals("data: [DONE]")) {
            return;
        }
        String cleanLine = line.startsWith("data: ") ? line.substring(6) : line;
        try {
            JsonNode node = objectMapper.readTree(cleanLine);
            String token = node.path("choices").path(0).path("delta").path(KEY_CONTENT).asText("");
            if (!token.isEmpty()) {
                full.append(token);
                if (onToken != null) {
                    onToken.accept(token);
                }
            }
        } catch (Exception ignored) {
            log.debug("Skipping malformed SSE line");
        }
    }

    private String buildAzureUrl() {
        return azureEndpoint.replaceAll("/$", "")
                + pathDeployments + azureDeployment
                + pathCompletionsVersion + AZURE_API_VERSION;
    }
}
