package com.example.prononciationtest.service;

import com.example.prononciationtest.service.ai.OllamaClientService;
import com.example.prononciationtest.service.ai.StreamService;
import com.example.prononciationtest.service.chatbot.ChatbotPromptBuilder;
import com.example.prononciationtest.service.chatbot.ChatbotService;
import com.example.prononciationtest.service.exercise.ExerciseService;
import com.example.prononciationtest.service.feedback.FeedbackService;
import com.example.prononciationtest.service.pronunciation.BattleService;
import com.example.prononciationtest.service.pronunciation.LevelTestService;
import com.example.prononciationtest.service.report.ReportService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OllamaServiceTest {

    @Mock private OllamaClientService ollamaClientService;
    @Mock private StreamService streamService;
    @Mock private ChatbotPromptBuilder chatbotPromptBuilder;
    @Mock private ChatbotService chatbotService;
    @Mock private FeedbackService feedbackService;
    @Mock private ExerciseService exerciseService;
    @Mock private ReportService reportService;
    @Mock private LevelTestService levelTestService;
    @Mock private BattleService battleService;

    @InjectMocks
    private OllamaService ollamaService;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
    }

    @Test
    void testCallRaw_delegates() {
        when(ollamaClientService.callRaw(anyString(), anyString(), anyInt(), anyDouble(), anyString()))
                .thenReturn("raw response");
        String result = ollamaService.callRaw("sys", "user", 50, 0.7, "fr");
        assertEquals("raw response", result);
        verify(ollamaClientService).callRaw("sys", "user", 50, 0.7, "fr");
    }

    @Test
    void testBuildChatbotUserContent_delegates() {
        when(chatbotPromptBuilder.buildChatbotUserContent(anyString(), anyList(), anyDouble(), anyString()))
                .thenReturn("user content");
        String result = ollamaService.buildChatbotUserContent("text", List.of(), 0.8, "en");
        assertEquals("user content", result);
        verify(chatbotPromptBuilder).buildChatbotUserContent("text", List.of(), 0.8, "en");
    }

    @Test
    void testGetChatbotSystemPrompt_delegates() {
        when(chatbotPromptBuilder.getChatbotSystemPrompt(anyString(), anyString(), anyString()))
                .thenReturn("system prompt");
        String result = ollamaService.getChatbotSystemPrompt("fr", "B1", "restaurant");
        assertEquals("system prompt", result);
        verify(chatbotPromptBuilder).getChatbotSystemPrompt("fr", "B1", "restaurant");
    }

    @Test
    void testBuildChatbotMessagesList_delegates() {
        List<Map<String, Object>> mockList = List.of(Map.of());
        when(chatbotPromptBuilder.buildChatbotMessagesList(anyList(), anyString(), anyString()))
                .thenReturn(mockList);
        List<Map<String, Object>> result = ollamaService.buildChatbotMessagesList(List.of(), "content", "system");
        assertEquals(mockList, result);
        verify(chatbotPromptBuilder).buildChatbotMessagesList(List.of(), "content", "system");
    }

    @Test
    void testStreamChatbotResponse_delegates() {
        Consumer<String> callback = token -> {};
        when(streamService.streamChatbotResponse(anyList(), any()))
                .thenReturn("streamed response");
        String result = ollamaService.streamChatbotResponse(List.of(), callback);
        assertEquals("streamed response", result);
        verify(streamService).streamChatbotResponse(List.of(), callback);
    }

    @Test
    void testGenerateChatbotResponse_delegates() {
        when(chatbotService.generateChatbotResponse(anyList(), anyString(), anyList(), anyDouble(), anyString(), anyString(), anyString()))
                .thenReturn("chatbot response");
        String result = ollamaService.generateChatbotResponse(List.of(), "userText", List.of(), 0.9, "fr", "A2", "scenario");
        assertEquals("chatbot response", result);
        verify(chatbotService).generateChatbotResponse(List.of(), "userText", List.of(), 0.9, "fr", "A2", "scenario");
    }

    @Test
    void testGeneratePhrase_delegates() {
        when(exerciseService.generatePhrase(anyString(), anyString())).thenReturn("phrase");
        String result = ollamaService.generatePhrase("fr", "B1");
        assertEquals("phrase", result);
        verify(exerciseService).generatePhrase("fr", "B1");
    }

    @Test
    void testGenerateExercises_delegates() {
        when(exerciseService.generateExercises(anyString(), anyString(), anyString(), anyInt())).thenReturn("exercises");
        String result = ollamaService.generateExercises("fr", "A1", "vocabulary", 5);
        assertEquals("exercises", result);
        verify(exerciseService).generateExercises("fr", "A1", "vocabulary", 5);
    }

    @Test
    void testGenerateExercisePhrases_delegates() {
        when(exerciseService.generateExercisePhrases(anyString(), anyString(), anyInt())).thenReturn("phrases");
        String result = ollamaService.generateExercisePhrases("en", "B2", 3);
        assertEquals("phrases", result);
        verify(exerciseService).generateExercisePhrases("en", "B2", 3);
    }

    @Test
    void testAdaptNextStep_delegates() {
        when(exerciseService.adaptNextStep(anyString(), anyString(), anyString(), anyInt(), anyString(), anyList()))
                .thenReturn("next step");
        String result = ollamaService.adaptNextStep("fr", "B1", "R", 70, "phrase", List.of());
        assertEquals("next step", result);
        verify(exerciseService).adaptNextStep("fr", "B1", "R", 70, "phrase", List.of());
    }

    @Test
    void testGeneratePlannerSummary_delegates() {
        when(exerciseService.generatePlannerSummary(anyString(), anyString(), anyList()))
                .thenReturn("summary");
        String result = ollamaService.generatePlannerSummary("fr", "A1", List.of());
        assertEquals("summary", result);
        verify(exerciseService).generatePlannerSummary("fr", "A1", List.of());
    }

    @Test
    void testFeedback_delegates() {
        when(feedbackService.feedback(anyString(), anyString(), anyInt(), anyString())).thenReturn("feedback");
        String result = ollamaService.feedback("expected", "transcription", 80, "en");
        assertEquals("feedback", result);
        verify(feedbackService).feedback("expected", "transcription", 80, "en");
    }

    @Test
    void testGenerateFeedback_delegates() {
        when(feedbackService.generateFeedback(anyString(), anyString(), anyString(), anyList(), anyMap(), anyString(), anyString()))
                .thenReturn("gen feedback");
        String result = ollamaService.generateFeedback("exp", "raw", "clean", List.of(), Map.of(), "fr", "B1");
        assertEquals("gen feedback", result);
        verify(feedbackService).generateFeedback("exp", "raw", "clean", List.of(), Map.of(), "fr", "B1");
    }

    @Test
    void testGenerateExerciseFeedback_delegates() {
        when(feedbackService.generateExerciseFeedback(anyString(), anyString(), anyString(), anyInt(), anyInt(), anyInt(), anyString()))
                .thenReturn("ex feedback");
        String result = ollamaService.generateExerciseFeedback("en", "B1", "grammar", 90, 9, 10, "detail");
        assertEquals("ex feedback", result);
        verify(feedbackService).generateExerciseFeedback("en", "B1", "grammar", 90, 9, 10, "detail");
    }

    @Test
    void testGenerateReportsAnalysis_delegates() {
        when(reportService.generateReportsAnalysis(anyString(), anyString(), anyList())).thenReturn("report");
        String result = ollamaService.generateReportsAnalysis("fr", "B2", List.of(90));
        assertEquals("report", result);
        verify(reportService).generateReportsAnalysis("fr", "B2", List.of(90));
    }

    @Test
    void testGenerateLevelTestPhrase_delegates() {
        when(levelTestService.generateLevelTestPhrase(anyString(), anyString(), anyString())).thenReturn("test phrase");
        String result = ollamaService.generateLevelTestPhrase("fr", "context", "A2");
        assertEquals("test phrase", result);
        verify(levelTestService).generateLevelTestPhrase("fr", "context", "A2");
    }

    @Test
    void testGenerateLevelTestTip_delegates() {
        when(levelTestService.generateLevelTestTip(anyString(), anyString())).thenReturn("test tip");
        String result = ollamaService.generateLevelTestTip("fr", "R");
        assertEquals("test tip", result);
        verify(levelTestService).generateLevelTestTip("fr", "R");
    }

    @Test
    void testGenerateLevelTestFeedback_delegates() {
        when(levelTestService.generateLevelTestFeedback(anyString(), anyString(), anyString(), anyString(), anyInt(), anyString()))
                .thenReturn("test feedback");
        String result = ollamaService.generateLevelTestFeedback("en", "S", "context", "phrase", 80, "Alice");
        assertEquals("test feedback", result);
        verify(levelTestService).generateLevelTestFeedback("en", "S", "context", "phrase", 80, "Alice");
    }

    @Test
    void testGenerateLevelTestSynthesis_delegates() {
        when(levelTestService.generateLevelTestSynthesis(anyString(), anyList(), anyString()))
                .thenReturn("synthesis");
        String result = ollamaService.generateLevelTestSynthesis("fr", List.of(), "B1");
        assertEquals("synthesis", result);
        verify(levelTestService).generateLevelTestSynthesis("fr", List.of(), "B1");
    }

    @Test
    void testGenerateBattlePhrase_delegates() {
        when(battleService.generateBattlePhrase(anyString(), anyString())).thenReturn("battle phrase");
        String result = ollamaService.generateBattlePhrase("fr", "B2");
        assertEquals("battle phrase", result);
        verify(battleService).generateBattlePhrase("fr", "B2");
    }

    @Test
    void testIsHealthy_delegates() {
        when(ollamaClientService.isHealthy()).thenReturn(true);
        boolean healthy = ollamaService.isHealthy();
        assertTrue(healthy);
        verify(ollamaClientService).isHealthy();
    }
}
