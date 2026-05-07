package com.example.prononciationtest.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

class OllamaServiceTest {

    @Mock
    private RestTemplate restTemplate;

    @Mock
    private ObjectMapper objectMapper;

    @Mock
    private PhraseTaxonomy taxonomy;

    @InjectMocks
    private OllamaService ollamaService;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
    }

    @Test
    void testGenerateLevelTestPhrase_FallbackToExactLevel() {
        // Arrange
        String lang = "fr";
        String soundContext = "chat, chose";
        String level = "C1";

        // Mock restTemplate timeout/exception
        when(restTemplate.exchange(anyString(), any(), any(), eq(String.class)))
                .thenThrow(new RuntimeException("I/O error on POST request: Timeout"));

        // Mock Taxonomy fallback
        when(taxonomy.getFallback(eq(lang), eq(level), eq("general")))
                .thenReturn("Une phrase sophistiquée de niveau C1.");

        // Act
        String result = ollamaService.generateLevelTestPhrase(lang, soundContext, level);

        // Assert
        assertEquals("Une phrase sophistiquée de niveau C1.", result, 
            "The service should fallback to the EXACT requested level (C1) and not B1.");
    }
}
