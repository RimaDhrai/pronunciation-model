package com.example.prononciationtest.service.feedback;

import com.example.prononciationtest.service.ai.OllamaClientService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

class FeedbackServiceTest {

    @Mock
    private OllamaClientService ollamaClientService;

    @InjectMocks
    private FeedbackService feedbackService;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
    }

    @Test
    void testFeedback_CallsOllamaCorrectly() {
        when(ollamaClientService.callOllama(anyString(), anyString(), anyInt(), anyDouble()))
                .thenReturn("Nice job!");

        String result = feedbackService.feedback("apple", "aple", 85, "en");
        assertEquals("Nice job!", result);
    }

    @Test
    void testGenerateFeedback_HallucinationAndOperations() {
        when(ollamaClientService.callOllama(anyString(), anyString(), anyInt(), anyDouble()))
                .thenReturn("Super pronunciation coach! 😊");

        Map<String, Object> scoreResult = new HashMap<>();
        scoreResult.put("score", 70);
        scoreResult.put("suspected_hallucination", true);
        scoreResult.put("n_expected", 5);
        scoreResult.put("n_match", 2);

        Map<String, Object> op1 = Map.of("op", "SUB", "expected", "bonjour", "got", "bon");
        Map<String, Object> op2 = Map.of("op", "DEL", "expected", "monde");
        scoreResult.put("ops", List.of(op1, op2));

        String result = feedbackService.generateFeedback(
                "bonjour monde",
                "bon",
                "bon",
                List.of(),
                scoreResult,
                "fr",
                "A1"
        );

        // Verify emojis are stripped by stripEmojis
        assertEquals("Super pronunciation coach!", result);
    }

    @Test
    void testGenerateExerciseFeedback() {
        when(ollamaClientService.callOllama(anyString(), anyString(), anyInt(), anyDouble()))
                .thenReturn("You did excellent on grammar exercises.");

        String result = feedbackService.generateExerciseFeedback(
                "en", "B2", "grammar", 90, 9, 10, "none"
        );

        assertEquals("You did excellent on grammar exercises.", result);
    }
}
