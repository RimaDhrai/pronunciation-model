package com.example.prononciationtest.service.ai;

import com.example.prononciationtest.service.PhraseTaxonomy;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

class OllamaClientServiceTest {

    @Mock
    private RestTemplate restTemplate;

    @Mock
    private ObjectMapper objectMapper;

    @Mock
    private PhraseTaxonomy taxonomy;

    @Mock
    private AzureOpenAIService azureOpenAIService;

    @InjectMocks
    private OllamaClientService ollamaClientService;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
    }

    @Test
    void testIsHealthy_OllamaHealthy() {
        when(azureOpenAIService.isAzureEnabled()).thenReturn(false);
        ResponseEntity<String> responseEntity = new ResponseEntity<>("healthy", HttpStatus.OK);
        when(restTemplate.getForEntity(anyString(), eq(String.class))).thenReturn(responseEntity);

        boolean healthy = ollamaClientService.isHealthy();
        assertTrue(healthy);
    }

    @Test
    void testIsHealthy_OllamaUnhealthy() {
        when(azureOpenAIService.isAzureEnabled()).thenReturn(false);
        when(restTemplate.getForEntity(anyString(), eq(String.class))).thenThrow(new RuntimeException("Connection failed"));

        boolean healthy = ollamaClientService.isHealthy();
        assertFalse(healthy);
    }

    @Test
    void testIsHealthy_AzureEnabledAndHealthy() {
        when(azureOpenAIService.isAzureEnabled()).thenReturn(true);
        when(azureOpenAIService.checkHealth()).thenReturn(true);

        boolean healthy = ollamaClientService.isHealthy();
        assertTrue(healthy);
    }

    @Test
    void testCallOllama_SuccessfulResponse() throws Exception {
        when(azureOpenAIService.isAzureEnabled()).thenReturn(false);
        
        byte[] responseBytes = "{}".getBytes();
        ResponseEntity<byte[]> responseEntity = new ResponseEntity<>(responseBytes, HttpStatus.OK);
        when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(byte[].class)))
                .thenReturn(responseEntity);

        JsonNode jsonNode = new ObjectMapper().readTree("{\"message\":{\"content\":\"Hello back\"}}");
        when(objectMapper.readTree(responseBytes)).thenReturn(jsonNode);

        String result = ollamaClientService.callOllama("system prompt", "user prompt", 50, 0.7);
        assertEquals("Hello back", result);
    }

    @Test
    void testCallRaw_HallucinationReturnsNull() throws Exception {
        when(azureOpenAIService.isAzureEnabled()).thenReturn(false);
        
        byte[] responseBytes = "{}".getBytes();
        ResponseEntity<byte[]> responseEntity = new ResponseEntity<>(responseBytes, HttpStatus.OK);
        when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(byte[].class)))
                .thenReturn(responseEntity);

        JsonNode jsonNode = new ObjectMapper().readTree("{\"message\":{\"content\":\"hallucinated phrase\"}}");
        when(objectMapper.readTree(responseBytes)).thenReturn(jsonNode);

        when(taxonomy.isHallucination("hallucinated phrase", "fr")).thenReturn(true);

        String result = ollamaClientService.callRaw("system", "user", 50, 0.7, "fr");
        assertNull(result);
    }
}
