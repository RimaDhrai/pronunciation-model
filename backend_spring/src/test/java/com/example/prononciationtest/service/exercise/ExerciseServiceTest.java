package com.example.prononciationtest.service.exercise;

import com.example.prononciationtest.service.PhraseTaxonomy;
import com.example.prononciationtest.service.ai.OllamaClientService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

class ExerciseServiceTest {

    @Mock
    private OllamaClientService ollamaClientService;

    @Mock
    private PhraseTaxonomy taxonomy;

    @InjectMocks
    private ExerciseService exerciseService;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
    }

    @Test
    void testGeneratePhrase_SuccessfulNoHallucination() {
        when(ollamaClientService.callOllama(anyString(), anyString(), anyInt(), anyDouble()))
                .thenReturn("Une jolie phrase.");
        when(taxonomy.isHallucination(anyString(), anyString())).thenReturn(false);

        String result = exerciseService.generatePhrase("fr", "A2");
        assertEquals("Une jolie phrase", result);
    }

    @Test
    void testGeneratePhrase_WithHallucinationReturnsFallback() {
        when(ollamaClientService.callOllama(anyString(), anyString(), anyInt(), anyDouble()))
                .thenReturn("Hallucinated response!!!");
        when(taxonomy.isHallucination("Hallucinated response", "en")).thenReturn(true);
        when(taxonomy.getFallback("en", "B1", "general")).thenReturn("Fallback English phrase.");

        String result = exerciseService.generatePhrase("en", "B1");
        assertEquals("Fallback English phrase.", result);
    }

    @Test
    void testGenerateExercises() {
        String expectedJson = "[{\"question\":\"...\"}]";
        when(ollamaClientService.callOllama(anyString(), anyString(), anyInt(), anyDouble()))
                .thenReturn(expectedJson);

        String result = exerciseService.generateExercises("fr", "B1", "grammar", 3);
        assertEquals(expectedJson, result);
    }

    @Test
    void testAdaptNextStep() {
        String expectedResponse = "{\"phrase\":\"...\"}";
        when(ollamaClientService.callOllama(anyString(), anyString(), anyInt(), anyDouble()))
                .thenReturn(expectedResponse);

        String result = exerciseService.adaptNextStep("fr", "B1", "R", 80, "Precedent", List.of("S"));
        assertEquals(expectedResponse, result);
    }

    @Test
    void testGeneratePlannerSummary() {
        String expectedResponse = "{\"mastered\":[]}";
        when(ollamaClientService.callOllama(anyString(), anyString(), anyInt(), anyDouble()))
                .thenReturn(expectedResponse);

        String result = exerciseService.generatePlannerSummary("en", "A1", List.of(Map.of("targetSound", "R", "score", 90)));
        assertEquals(expectedResponse, result);
    }
}
