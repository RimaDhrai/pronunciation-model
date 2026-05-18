package com.example.prononciationtest.service.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpMethod;
import org.springframework.http.client.ClientHttpResponse;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RequestCallback;
import org.springframework.web.client.ResponseExtractor;
import org.springframework.web.client.RestTemplate;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class StreamServiceTest {

    @Mock
    private RestTemplate restTemplate;

    @Mock
    private OllamaClientService ollamaClientService;

    @Mock
    private AzureOpenAIService azureOpenAIService;

    @Mock
    private ClientHttpResponse clientHttpResponse;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private StreamService streamService;

    @BeforeEach
    void setUp() {
        streamService = new StreamService(restTemplate, objectMapper, ollamaClientService, azureOpenAIService);
        ReflectionTestUtils.setField(streamService, "chatbotModel", "qwen2.5:3b");
    }

    @Test
    void streamChatbotResponse_whenAzureEnabled_delegatesToAzure() {
        when(azureOpenAIService.isAzureEnabled()).thenReturn(true);
        when(azureOpenAIService.streamAzureChatbot(anyList(), any())).thenReturn("<think>Reasoning...</think>Hello Azure!");

        List<Map<String, Object>> messages = List.of(Map.of("role", "user", "content", "hi"));
        StringBuilder resultTokens = new StringBuilder();

        String response = streamService.streamChatbotResponse(messages, resultTokens::append);

        assertThat(response).isEqualTo("Hello Azure!");
        verifyNoInteractions(restTemplate, ollamaClientService);
    }

    @Test
    void streamChatbotResponse_whenOllamaEnabled_success() throws IOException {
        when(azureOpenAIService.isAzureEnabled()).thenReturn(false);
        when(ollamaClientService.getOllamaBaseUrl()).thenReturn("http://localhost:11434");

        // Prepare simulated streaming stream data
        String line1 = "{\"message\": {\"content\": \"Hello \"}}\n";
        String line2 = "{\"message\": {\"content\": \"Ollama!\"}}\n";
        InputStream byteStream = new ByteArrayInputStream((line1 + line2).getBytes(StandardCharsets.UTF_8));
        when(clientHttpResponse.getBody()).thenReturn(byteStream);

        // Stub execute to run the ResponseExtractor
        when(restTemplate.execute(
            eq("http://localhost:11434/api/chat"),
            eq(HttpMethod.POST),
            any(RequestCallback.class),
            any(ResponseExtractor.class)
        )).thenAnswer(invocation -> {
            ResponseExtractor<?> extractor = invocation.getArgument(3);
            return extractor.extractData(clientHttpResponse);
        });

        List<Map<String, Object>> messages = List.of(Map.of("role", "user", "content", "hi"));
        StringBuilder resultTokens = new StringBuilder();

        String response = streamService.streamChatbotResponse(messages, resultTokens::append);

        assertThat(response).isEqualTo("Hello Ollama!");
        assertThat(resultTokens.toString()).isEqualTo("Hello Ollama!");
    }

    @Test
    void streamChatbotResponse_whenOllamaFails_returnsFallback() {
        when(azureOpenAIService.isAzureEnabled()).thenReturn(false);
        when(ollamaClientService.getOllamaBaseUrl()).thenReturn("http://localhost:11434");

        when(restTemplate.execute(
            eq("http://localhost:11434/api/chat"),
            eq(HttpMethod.POST),
            any(RequestCallback.class),
            any(ResponseExtractor.class)
        )).thenThrow(new RuntimeException("Connection Refused"));

        List<Map<String, Object>> messages = List.of(Map.of("role", "user", "content", "hi"));

        String response = streamService.streamChatbotResponse(messages, token -> {});

        assertThat(response).contains("Réponse indisponible");
    }
}
