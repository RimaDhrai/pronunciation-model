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
import com.example.prononciationtest.service.iservice.IOllamaService;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

@Service
public class OllamaService implements IOllamaService {

    private final OllamaClientService ollamaClientService;
    private final StreamService streamService;
    private final ChatbotPromptBuilder chatbotPromptBuilder;
    private final ChatbotService chatbotService;
    private final FeedbackService feedbackService;
    private final ExerciseService exerciseService;
    private final ReportService reportService;
    private final LevelTestService levelTestService;
    private final BattleService battleService;

    public OllamaService(OllamaClientService ollamaClientService,
                         StreamService streamService,
                         ChatbotPromptBuilder chatbotPromptBuilder,
                         ChatbotService chatbotService,
                         FeedbackService feedbackService,
                         ExerciseService exerciseService,
                         ReportService reportService,
                         LevelTestService levelTestService,
                         BattleService battleService) {
        this.ollamaClientService = ollamaClientService;
        this.streamService = streamService;
        this.chatbotPromptBuilder = chatbotPromptBuilder;
        this.chatbotService = chatbotService;
        this.feedbackService = feedbackService;
        this.exerciseService = exerciseService;
        this.reportService = reportService;
        this.levelTestService = levelTestService;
        this.battleService = battleService;
    }

    // ── Client AI delegate methods ───────────────────────────────────────────

    public String callRaw(String system, String userPrompt, int maxTokens, double temperature, String expectedLang) {
        return ollamaClientService.callRaw(system, userPrompt, maxTokens, temperature, expectedLang);
    }

    // ── Chatbot / Prompt Builder delegate methods ────────────────────────────

    public String buildChatbotUserContent(String userText, List<String> weakWords, Double pronScore, String lang) {
        return chatbotPromptBuilder.buildChatbotUserContent(userText, weakWords, pronScore, lang);
    }

    public String getChatbotSystemPrompt(String lang, String level, String scenario) {
        return chatbotPromptBuilder.getChatbotSystemPrompt(lang, level, scenario);
    }

    public List<Map<String, Object>> buildChatbotMessagesList(List<Map<String, String>> history, String userContent, String systemPrompt) {
        return chatbotPromptBuilder.buildChatbotMessagesList(history, userContent, systemPrompt);
    }

    public String streamChatbotResponse(List<Map<String, Object>> messages, Consumer<String> onToken) {
        return streamService.streamChatbotResponse(messages, onToken);
    }

    @Override
    public String generateChatbotResponse(List<Map<String, String>> history,
                                          String userText,
                                          List<String> weakWords,
                                          Double pronScore,
                                          String lang,
                                          String level,
                                          String scenario) {
        return chatbotService.generateChatbotResponse(history, userText, weakWords, pronScore, lang, level, scenario);
    }

    // ── Practice / Exercises delegate methods ───────────────────────────────

    @Override
    public String generatePhrase(String lang, String level) {
        return exerciseService.generatePhrase(lang, level);
    }

    @Override
    public String generateExercises(String lang, String level, String type, int count) {
        return exerciseService.generateExercises(lang, level, type, count);
    }

    @Override
    public String generateExercisePhrases(String lang, String level, int count) {
        return exerciseService.generateExercisePhrases(lang, level, count);
    }

    @Override
    public String adaptNextStep(String lang, String level, String targetSound,
                                 int lastScore, String lastPhrase, List<String> weakSounds) {
        return exerciseService.adaptNextStep(lang, level, targetSound, lastScore, lastPhrase, weakSounds);
    }

    @Override
    public String generatePlannerSummary(String lang, String level, List<Map<String, Object>> stepResults) {
        return exerciseService.generatePlannerSummary(lang, level, stepResults);
    }

    // ── Feedback delegate methods ───────────────────────────────────────────

    @Override
    public String feedback(String expectedPhrase, String transcription, int score, String lang) {
        return feedbackService.feedback(expectedPhrase, transcription, score, lang);
    }

    @Override
    public String generateFeedback(String expectedPhrase,
                                   String rawTranscription,
                                   String cleanTranscription,
                                   List<String> fillers,
                                   Map<String, Object> scoreResult,
                                   String lang,
                                   String level) {
        return feedbackService.generateFeedback(expectedPhrase, rawTranscription, cleanTranscription, fillers, scoreResult, lang, level);
    }

    @Override
    public String generateExerciseFeedback(String lang, String level, String type,
                                           int score, int correct, int total, String errorsDetail) {
        return feedbackService.generateExerciseFeedback(lang, level, type, score, correct, total, errorsDetail);
    }

    // ── Reports Analysis delegate methods ────────────────────────────────────

    public String generateReportsAnalysis(String lang, String level, List<Integer> scores) {
        return reportService.generateReportsAnalysis(lang, level, scores);
    }

    // ── Level Test delegate methods ──────────────────────────────────────────

    @Override
    public String generateLevelTestPhrase(String lang, String soundContext, String levelHint) {
        return levelTestService.generateLevelTestPhrase(lang, soundContext, levelHint);
    }

    @Override
    public String generateLevelTestTip(String lang, String soundLabel) {
        return levelTestService.generateLevelTestTip(lang, soundLabel);
    }

    @Override
    public String generateLevelTestFeedback(String lang, String soundLabel,
                                            String contextWords, String phrase, int score, String userName) {
        return levelTestService.generateLevelTestFeedback(lang, soundLabel, contextWords, phrase, score, userName);
    }

    @Override
    public String generateLevelTestSynthesis(String lang,
                                             List<Map<String, Object>> history,
                                             String finalLevel) {
        return levelTestService.generateLevelTestSynthesis(lang, history, finalLevel);
    }

    // ── PvP Battle delegate methods ──────────────────────────────────────────

    @Override
    public String generateBattlePhrase(String lang, String level) {
        return battleService.generateBattlePhrase(lang, level);
    }

    // ── Health delegate methods ──────────────────────────────────────────────

    @Override
    public boolean isHealthy() {
        return ollamaClientService.isHealthy();
    }
}
