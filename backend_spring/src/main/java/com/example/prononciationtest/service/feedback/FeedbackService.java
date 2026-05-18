package com.example.prononciationtest.service.feedback;

import com.example.prononciationtest.service.ai.OllamaClientService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class FeedbackService {

    private static final Logger log = LoggerFactory.getLogger(FeedbackService.class);
    private static final String KEY_SCORE = "score";

    private final OllamaClientService ollamaClientService;

    public FeedbackService(OllamaClientService ollamaClientService) {
        this.ollamaClientService = ollamaClientService;
    }

    public String feedback(String expectedPhrase, String transcription, int score, String lang) {
        String system = "fr".equals(lang)
                ? "Coach prononciation. 1-2 phrases en fran\u00e7ais, bienveillant."
                : "Pronunciation coach. 1-2 sentences in English, encouraging.";
        String prompt = "fr".equals(lang)
                ? String.format("\u00ab%s\u00bb\u2192\u00ab%s\u00bb score=%d", expectedPhrase, transcription, score)
                : String.format("\"%s\"\u2192\"%s\" score=%d", expectedPhrase, transcription, score);

        return ollamaClientService.callOllama(system, prompt, 80, 0.4);
    }

    @SuppressWarnings("unchecked")
    public String generateFeedback(
            String expectedPhrase,
            String rawTranscription,
            String cleanTranscription,
            List<String> fillers,
            Map<String, Object> scoreResult,
            String lang,
            String level) {
        StringBuilder errors = new StringBuilder();

        List<Map<String, Object>> ops = (List<Map<String, Object>>) scoreResult.get("ops");

        if (ops != null) {
            for (Map<String, Object> op : ops) {
                switch ((String) op.get("op")) {
                    case "SUB" -> errors.append(
                            String.format("  - '%s' \u2192 '%s'%n", op.get("expected"), op.get("got")));
                    case "DEL" -> errors.append(
                            String.format("  - '%s' : non prononc\u00e9%n", op.get("expected")));
                    case "INS" -> errors.append(
                            String.format("  - '%s' : ajout\u00e9%n", op.get("got")));
                    default -> log.trace("Unknown op");
                }
            }
        }
        Boolean hallucination = (Boolean) scoreResult.get("suspected_hallucination");
        int nExpected = scoreResult.containsKey("n_expected") ? ((Number) scoreResult.get("n_expected")).intValue() : 0;
        int nMatch = scoreResult.containsKey("n_match") ? ((Number) scoreResult.get("n_match")).intValue() : 0;

        if (errors.length() == 0) {
            errors.append("  - Aucune erreur majeure\n");
        }

        if (Boolean.TRUE.equals(hallucination)) {
            String halNote = "fr".equals(lang)
                    ? String.format("  - \u26A0\uFE0F L'apprenant n'a probablement prononc\u00e9 que %d/%d mots de la phrase%n",
                            nMatch, nExpected)
                    : String.format("  - \u26A0\uFE0F Learner likely said only %d/%d words of the phrase%n", nMatch,
                            nExpected);
            errors.insert(0, halNote);
        }

        String systemPrompt = "fr".equals(lang)
                ? "Coach prononciation. 3 parties courtes : 1. Ce qui etait bien. 2. Mot(s) mal prononce(s) ou manquant(s). 3. Conseil pratique pour ce son. Max 60 mots. Pas d emojis. Ton encourageant."
                : "Pronunciation coach. 3 short parts: 1. What was good. 2. Mispronounced or missing word(s). 3. Practical tip for that sound. Max 60 words. No emojis. Encouraging tone.";

        String userMsg = "fr".equals(lang)
                ? String.format(
                        "Niveau %s%nPhrase attendue : \"%s\"%nTranscrit : \"%s\"%nScore : %s/100%nDetails:%n%s",
                        level, expectedPhrase, cleanTranscription, scoreResult.get(KEY_SCORE), errors)
                : String.format("Level %s%nExpected: \"%s\"%nTranscribed: \"%s\"%nScore: %s/100%nDetails:%n%s",
                        level, expectedPhrase, cleanTranscription, scoreResult.get(KEY_SCORE), errors);

        return stripEmojis(ollamaClientService.callOllama(systemPrompt, userMsg, 160, 0.3));
    }

    public String generateExerciseFeedback(String lang, String level, String type,
            int score, int correct, int total, String errorsDetail) {
        boolean fr = "fr".equals(lang);
        String system = fr
                ? "Tu es un coach p\u00e9dagogique bienveillant. R\u00e9ponds en 2-3 phrases maximum."
                : "You are an encouraging pedagogical coach. Reply in 2-3 sentences maximum.";

        String errors = errorsDetail.isBlank() ? (fr ? "aucune" : "none") : errorsDetail;
        String prompt = fr
                ? String.format(
                        "Niveau %s \u2014 exercices de %s. Score : %d/100 (%d/%d bonnes r\u00e9ponses). Erreurs : %s. Donne un feedback motivant.",
                        level, type, score, correct, total, errors)
                : String.format(
                        "Level %s \u2014 %s exercises. Score: %d/100 (%d/%d correct). Errors: %s. Give motivating feedback.",
                        level, type, score, correct, total, errors);

        return ollamaClientService.callOllama(system, prompt, 120, 0.5);
    }

    private String stripEmojis(String s) {
        if (s == null) {
            return "";
        }
        s = s.replaceAll("[\\uD800-\\uDFFF]", "");
        s = s.replaceAll("\\p{So}", "");
        return s.trim();
    }
}
