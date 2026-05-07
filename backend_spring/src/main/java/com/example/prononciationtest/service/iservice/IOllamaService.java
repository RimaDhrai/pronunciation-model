package com.example.prononciationtest.service.iservice;

import java.util.List;
import java.util.Map;

public interface IOllamaService {

    // ── Practice / exercises ──────────────────────────────────────────────────

    String generatePhrase(String lang, String level);

    String feedback(String expectedPhrase, String transcription, int score, String lang);

    String generateFeedback(String expectedPhrase,
                            String rawTranscription,
                            String cleanTranscription,
                            List<String> fillers,
                            Map<String, Object> scoreResult,
                            String lang,
                            String level);

    String generateChatbotResponse(List<Map<String, String>> history,
                                   String userText,
                                   List<String> weakWords,
                                   Double pronScore,
                                   String lang,
                                   String level,
                                   String scenario);

    String generateExercises(String lang, String level, String type, int count);

    String generateExerciseFeedback(String lang, String level, String type,
                                    int score, int correct, int total, String errorsDetail);

    String generateExercisePhrases(String lang, String level, int count);

    String adaptNextStep(String lang, String level, String targetSound,
                         int lastScore, String lastPhrase, List<String> weakSounds);

    String generatePlannerSummary(String lang, String level, List<Map<String, Object>> stepResults);

    // ── Level-test agent ──────────────────────────────────────────────────────

    /**
     * Generates one practice phrase for the level-test (sound-targeted).
     * @param soundContext  comma-separated example words (e.g. "rouge, renard, bruit")
     * @param levelHint     plain-text length/complexity hint (e.g. "simple (8-10 words)")
     */
    String generateLevelTestPhrase(String lang, String soundContext, String levelHint);

    /**
     * Generates a one-sentence pronunciation tip for a given sound label.
     */
    String generateLevelTestTip(String lang, String soundLabel);

    /**
     * Generates personalized feedback for one level-test step.
     * @param soundLabel    human-readable sound name (e.g. "Le R grasseyé [ʁ]")
     * @param contextWords  example words for that sound
     * @param phrase        the phrase the learner pronounced
     * @param score         0-100 pronunciation score
     */
    String generateLevelTestFeedback(String lang, String soundLabel,
                                     String contextWords, String phrase, int score, String userName);


    /**
     * Generates the end-of-test synthesis (3-4 sentences, mentions strong/weak sounds).
     * @param history    list of step results (each has sound_label, score, phrase)
     * @param finalLevel computed CEFR level
     */
    String generateLevelTestSynthesis(String lang,
                                      List<Map<String, Object>> history,
                                      String finalLevel);

    String generateBattlePhrase(String lang, String level);

    boolean isHealthy();
}
