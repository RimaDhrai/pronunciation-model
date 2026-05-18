package com.example.prononciationtest.service.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

@Service
public class StreamService {

    private static final Logger log = LoggerFactory.getLogger(StreamService.class);

    private static final String REGEX_THINK = "(?i)<think>[\\s\\S]*?</think>";
    private static final String KEY_STREAM = "stream";
    private static final String KEY_TEMPERATURE = "temperature";
    private static final String KEY_MESSAGES = "messages";
    private static final String KEY_MESSAGE = "message";
    private static final String KEY_CONTENT = "content";

    @Value("${ollama.model.chatbot:#{'qwen2.5:3b'}}")
    private String chatbotModel;

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final OllamaClientService ollamaClientService;
    private final AzureOpenAIService azureOpenAIService;

    public StreamService(RestTemplate restTemplate,
                         ObjectMapper objectMapper,
                         OllamaClientService ollamaClientService,
                         AzureOpenAIService azureOpenAIService) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
        this.ollamaClientService = ollamaClientService;
        this.azureOpenAIService = azureOpenAIService;
    }

    public String streamChatbotResponse(List<Map<String, Object>> messages, Consumer<String> onToken) {
        if (azureOpenAIService.isAzureEnabled()) {
            String raw = azureOpenAIService.streamAzureChatbot(messages, onToken);
            String cleaned = raw.replaceAll(REGEX_THINK, "").trim();
            return cleaned.isBlank() ? raw : cleaned;
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", chatbotModel);
        body.put(KEY_STREAM, true);
        body.put("options", Map.of(KEY_TEMPERATURE, 0.72, "num_predict", 110, "num_ctx", 1024));
        body.put(KEY_MESSAGES, messages);

        StringBuilder full = new StringBuilder();
        try {
            restTemplate.execute(
                    ollamaClientService.getOllamaBaseUrl() + "/api/chat",
                    HttpMethod.POST,
                    request -> {
                        request.getHeaders().setContentType(MediaType.APPLICATION_JSON);
                        objectMapper.writeValue(request.getBody(), body);
                    },
                    response -> {
                        try (BufferedReader reader = new BufferedReader(
                                new InputStreamReader(response.getBody(), StandardCharsets.UTF_8))) {
                            processOllamaStream(reader, full, onToken);
                        }
                        return null;
                    });
        } catch (Exception e) {
            log.error("Ollama streaming failed", e);
            if (full.isEmpty()) {
                return "\u26A0\uFE0F R\u00e9ponse indisponible";
            }
        }
        String raw = full.toString().trim();
        String cleaned = raw.replaceAll(REGEX_THINK, "").trim();
        return cleaned.isBlank() ? raw : cleaned;
    }

    private void processOllamaStream(BufferedReader reader, StringBuilder full, Consumer<String> onToken) throws IOException {
        String line;
        while ((line = reader.readLine()) != null) {
            if (line.isBlank()) {
                continue;
            }
            parseAndProcessOllamaLine(line, full, onToken);
        }
    }

    private void parseAndProcessOllamaLine(String line, StringBuilder full, Consumer<String> onToken) {
        try {
            JsonNode node = objectMapper.readTree(line);
            String token = node.path(KEY_MESSAGE).path(KEY_CONTENT).asText("");
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
}
