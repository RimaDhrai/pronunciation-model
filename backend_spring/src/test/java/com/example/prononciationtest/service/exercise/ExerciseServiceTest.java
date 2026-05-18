package com.example.prononciationtest.service.exercise;

import com.example.prononciationtest.service.PhraseTaxonomy;
import com.example.prononciationtest.service.ai.OllamaClientService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.util.Collections;
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
    void testGeneratePhrase_SuccessfulNoHallucination_AllLevelsAndLangs() {
        when(ollamaClientService.callOllama(anyString(), anyString(), anyInt(), anyDouble()))
                .thenReturn("Une jolie phrase.");
        when(taxonomy.isHallucination(anyString(), anyString())).thenReturn(false);

        // A1 French
        assertEquals("Une jolie phrase", exerciseService.generatePhrase("fr", "A1"));
        // A2 French
        assertEquals("Une jolie phrase", exerciseService.generatePhrase("fr", "A2"));
        // B1 French
        assertEquals("Une jolie phrase", exerciseService.generatePhrase("fr", "B1"));
        // B2 French
        assertEquals("Une jolie phrase", exerciseService.generatePhrase("fr", "B2"));
        // C1 French
        assertEquals("Une jolie phrase", exerciseService.generatePhrase("fr", "C1"));
        // Default French
        assertEquals("Une jolie phrase", exerciseService.generatePhrase("fr", "C2"));

        // A1 English
        when(ollamaClientService.callOllama(anyString(), anyString(), anyInt(), anyDouble()))
                .thenReturn("A nice phrase.");
        assertEquals("A nice phrase", exerciseService.generatePhrase("en", "A1"));
        // A2 English
        assertEquals("A nice phrase", exerciseService.generatePhrase("en", "A2"));
        // B1 English
        assertEquals("A nice phrase", exerciseService.generatePhrase("en", "B1"));
        // B2 English
        assertEquals("A nice phrase", exerciseService.generatePhrase("en", "B2"));
        // C1 English
        assertEquals("A nice phrase", exerciseService.generatePhrase("en", "C1"));
        // Default English
        assertEquals("A nice phrase", exerciseService.generatePhrase("en", "C2"));
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
    void testGenerateExercises_AllTypesAndLangs() {
        String expectedJson = "[{\"question\":\"...\"}]";
        when(ollamaClientService.callOllama(anyString(), anyString(), anyInt(), anyDouble()))
                .thenReturn(expectedJson);

        // French types
        assertEquals(expectedJson, exerciseService.generateExercises("fr", "B1", "grammar", 3));
        assertEquals(expectedJson, exerciseService.generateExercises("fr", "B1", "vocabulary", 3));
        assertEquals(expectedJson, exerciseService.generateExercises("fr", "B1", "pronunciation", 3));
        assertEquals(expectedJson, exerciseService.generateExercises("fr", "B1", "listening", 3));
        assertEquals(expectedJson, exerciseService.generateExercises("fr", "B1", "other", 3));

        // English types
        assertEquals(expectedJson, exerciseService.generateExercises("en", "B1", "grammar", 3));
        assertEquals(expectedJson, exerciseService.generateExercises("en", "B1", "other", 3));
    }

    @Test
    void testGenerateExercisePhrases_FrenchAndEnglish() {
        String expectedJson = "[\"phrase1\"]";
        when(ollamaClientService.callOllama(anyString(), anyString(), anyInt(), anyDouble()))
                .thenReturn(expectedJson);

        assertEquals(expectedJson, exerciseService.generateExercisePhrases("fr", "A2", 2));
        assertEquals(expectedJson, exerciseService.generateExercisePhrases("en", "A2", 2));
    }

    @Test
    void testAdaptNextStep_LangsAndWeakSounds() {
        String expectedResponse = "{\"phrase\":\"...\"}";
        when(ollamaClientService.callOllama(anyString(), anyString(), anyInt(), anyDouble()))
                .thenReturn(expectedResponse);

        // French with weak sounds
        assertEquals(expectedResponse, exerciseService.adaptNextStep("fr", "B1", "R", 80, "Precedent", List.of("S")));
        // French with empty weak sounds
        assertEquals(expectedResponse, exerciseService.adaptNextStep("fr", "B1", "R", 80, "Precedent", Collections.emptyList()));
        // French with null weak sounds
        assertEquals(expectedResponse, exerciseService.adaptNextStep("fr", "B1", "R", 80, "Precedent", null));

        // English with weak sounds
        assertEquals(expectedResponse, exerciseService.adaptNextStep("en", "B1", "R", 80, "Precedent", List.of("S")));
        // English with empty weak sounds
        assertEquals(expectedResponse, exerciseService.adaptNextStep("en", "B1", "R", 80, "Precedent", Collections.emptyList()));
    }

    @Test
    void testGeneratePlannerSummary_LangsAndSoundKeys() {
        String expectedResponse = "{\"mastered\":[]}";
        when(ollamaClientService.callOllama(anyString(), anyString(), anyInt(), anyDouble()))
                .thenReturn(expectedResponse);

        // English with targetSound key
        assertEquals(expectedResponse, exerciseService.generatePlannerSummary("en", "A1", List.of(Map.of("targetSound", "R", "score", 90))));
        // English with target_sound fallback key
        assertEquals(expectedResponse, exerciseService.generatePlannerSummary("en", "A1", List.of(Map.of("target_sound", "R", "score", 90))));

        // French
        assertEquals(expectedResponse, exerciseService.generatePlannerSummary("fr", "A1", List.of(Map.of("targetSound", "R", "score", 90))));
    }
}
