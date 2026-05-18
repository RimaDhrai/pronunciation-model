package com.example.prononciationtest.service.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.http.*;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AzureOpenAIServiceTest {

    @Mock
    private RestTemplate restTemplate;

    @Mock
    private ObjectMapper objectMapper;

    @InjectMocks
    private AzureOpenAIService azureOpenAIService;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        // Inject configuration values using ReflectionTestUtils
        ReflectionTestUtils.setField(azureOpenAIService, "pathDeployments", "/openai/deployments/");
        ReflectionTestUtils.setField(azureOpenAIService, "pathCompletionsVersion", "/chat/completions?api-version=");
        ReflectionTestUtils.setField(azureOpenAIService, "azureEnabled", true);
        ReflectionTestUtils.setField(azureOpenAIService, "azureEndpoint", "http://localhost");
        ReflectionTestUtils.setField(azureOpenAIService, "azureKey", "mock-key");
        ReflectionTestUtils.setField(azureOpenAIService, "azureDeployment", "gpt-4");
    }

    @Test
    void testIsAzureEnabled() {
        assertTrue(azureOpenAIService.isAzureEnabled());
    }

    @Test
    void testCheckHealth_Success() {
        ResponseEntity<String> response = new ResponseEntity<>("ok", HttpStatus.OK);
        when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
                .thenReturn(response);

        boolean healthy = azureOpenAIService.checkHealth();
        assertTrue(healthy);
    }

    @Test
    void testCheckHealth_Failure() {
        when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
                .thenThrow(new RuntimeException("API Unreachable"));

        boolean healthy = azureOpenAIService.checkHealth();
        assertFalse(healthy);
    }

    @Test
    void testCallAzureOpenAI_Success() throws Exception {
        byte[] bodyBytes = "{}".getBytes();
        ResponseEntity<byte[]> response = new ResponseEntity<>(bodyBytes, HttpStatus.OK);
        when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(byte[].class)))
                .thenReturn(response);

        JsonNode choiceNode = mock(JsonNode.class);
        JsonNode messageNode = mock(JsonNode.class);
        JsonNode contentNode = mock(JsonNode.class);
        JsonNode rootNode = mock(JsonNode.class);

        when(rootNode.path("choices")).thenReturn(choiceNode);
        when(choiceNode.path(0)).thenReturn(choiceNode);
        when(choiceNode.path("message")).thenReturn(messageNode);
        when(messageNode.path("content")).thenReturn(contentNode);
        when(contentNode.asText("")).thenReturn("Hello from Azure");

        when(objectMapper.readTree(bodyBytes)).thenReturn(rootNode);

        String responseText = azureOpenAIService.callAzureOpenAI(List.of(Map.of("role", "user", "content", "hi")), 100, 0.7);
        assertEquals("Hello from Azure", responseText);
    }

    @Test
    void testCallAzureOpenAI_NullBody() {
        ResponseEntity<byte[]> response = new ResponseEntity<>(null, HttpStatus.OK);
        when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(byte[].class)))
                .thenReturn(response);

        String responseText = azureOpenAIService.callAzureOpenAI(List.of(Map.of("role", "user", "content", "hi")), 100, 0.7);
        assertEquals("Response unavailable", responseText);
    }

    @Test
    void testCallAzureOpenAI_Exception() {
        when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(byte[].class)))
                .thenThrow(new RuntimeException("JSON Parse Error"));

        String responseText = azureOpenAIService.callAzureOpenAI(List.of(Map.of("role", "user", "content", "hi")), 100, 0.7);
        assertTrue(responseText.contains("Response unavailable:"));
    }
}
