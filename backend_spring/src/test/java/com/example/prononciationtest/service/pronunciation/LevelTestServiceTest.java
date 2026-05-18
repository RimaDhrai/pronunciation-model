package com.example.prononciationtest.service.pronunciation;

import com.example.prononciationtest.service.PhraseTaxonomy;
import com.example.prononciationtest.service.ai.OllamaClientService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

class LevelTestServiceTest {

    @Mock
    private OllamaClientService ollamaClientService;

    @Mock
    private PhraseTaxonomy taxonomy;

    @InjectMocks
    private LevelTestService levelTestService;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
    }

    @Test
    void testGenerateLevelTestPhrase_NoHallucination() {
        when(ollamaClientService.callOllama(anyString(), anyString(), anyInt(), anyDouble()))
                .thenReturn("Voici une phrase de test.");
        when(taxonomy.isHallucination(anyString(), anyString())).thenReturn(false);

        String result = levelTestService.generateLevelTestPhrase("fr", "chat, chien", "A2");
        assertEquals("Voici une phrase de test.", result);
    }

    @Test
    void testGenerateLevelTestPhrase_WithHallucinationReturnsFallback() {
        when(ollamaClientService.callOllama(anyString(), anyString(), anyInt(), anyDouble()))
                .thenReturn("Hallucinated level test.");
        when(taxonomy.isHallucination(anyString(), anyString())).thenReturn(true);
        when(taxonomy.getFallback(anyString(), anyString(), eq("general"))).thenReturn("Fallback test phrase.");

        String result = levelTestService.generateLevelTestPhrase("fr", "chat", "B1");
        assertEquals("Fallback test phrase.", result);
    }

    @Test
    void testGenerateLevelTestTip() {
        when(ollamaClientService.callOllama(anyString(), anyString(), anyInt(), anyDouble()))
                .thenReturn("Un conseil tres pratique pour ce son.");

        String result = levelTestService.generateLevelTestTip("fr", "R");
        assertEquals("Un conseil tres pratique pour ce son.", result);
    }

    @Test
    void testGenerateLevelTestFeedback_UsesCacheAndFallback() {
        // Cache misses but Ollama returns good feedback
        when(ollamaClientService.callOllama(anyString(), anyString(), anyInt(), anyDouble()))
                .thenReturn("Superbe travail avec ce son !");

        String result = levelTestService.generateLevelTestFeedback("fr", "R", "rouge", "Un chat rouge", 85, "John");
        assertEquals("Superbe travail avec ce son !", result);

        // Subsequent call with same parameters should return the cached response
        String cachedResult = levelTestService.generateLevelTestFeedback("fr", "R", "rouge", "Un chat rouge", 85, "John");
        assertEquals("Superbe travail avec ce son !", cachedResult);
    }

    @Test
    void testGenerateLevelTestSynthesis() {
        when(ollamaClientService.callOllama(anyString(), anyString(), anyInt(), anyDouble()))
                .thenReturn("Bilan final tres encourageant.");

        List<Map<String, Object>> history = List.of(
                Map.of("sound_label", "R", "score", 90),
                Map.of("sound_label", "S", "score", 80)
        );

        String result = levelTestService.generateLevelTestSynthesis("fr", history, "B2");
        assertEquals("Bilan final tres encourageant.", result);
    }
}
