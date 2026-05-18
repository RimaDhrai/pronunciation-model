package com.example.prononciationtest.service.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class StreamServiceTest {

    @Mock
    private RestTemplate restTemplate;

    @Mock
    private ObjectMapper objectMapper;

    @Mock
    private OllamaClientService ollamaClientService;

    @Mock
    private AzureOpenAIService azureOpenAIService;

    @InjectMocks
    private StreamService streamService;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(streamService, "chatbotModel", "qwen-test");
    }

    @Test
    void streamChatbotResponse_whenAzureEnabled_scrubsThinkTagsAndReturnsCleanedResponse() {
        when(azureOpenAIService.isAzureEnabled()).thenReturn(true);
        when(azureOpenAIService.streamAzureChatbot(any(), any()))
                .thenReturn("<think>Let me think...\nI should greet the user.</think> Hello user!");

        String response = streamService.streamChatbotResponse(List.of(Map.of("role", "user", "content", "hi")), token -> {});

        assertThat(response).isEqualTo("Hello user!");
    }

    @Test
    void streamChatbotResponse_whenAzureEnabledAndCleanedEmpty_returnsRawResponse() {
        when(azureOpenAIService.isAzureEnabled()).thenReturn(true);
        when(azureOpenAIService.streamAzureChatbot(any(), any()))
                .thenReturn("<think>Thinking only...</think>");

        String response = streamService.streamChatbotResponse(List.of(), token -> {});

        assertThat(response).isEqualTo("<think>Thinking only...</think>");
    }

    @Test
    void streamChatbotResponse_whenOllamaThrowsException_returnsUnavailableMessage() {
        when(azureOpenAIService.isAzureEnabled()).thenReturn(false);
        when(ollamaClientService.getOllamaBaseUrl()).thenReturn("http://localhost:11434");
        
        doThrow(new RuntimeException("Connection refused"))
                .when(restTemplate).execute(anyString(), any(), any(), any());

        String response = streamService.streamChatbotResponse(List.of(), token -> {});

        assertThat(response).contains("indisponible");
    }
}
