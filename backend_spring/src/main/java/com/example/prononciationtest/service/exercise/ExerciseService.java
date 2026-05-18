package com.example.prononciationtest.service.exercise;

import com.example.prononciationtest.service.PhraseTaxonomy;
import com.example.prononciationtest.service.ai.OllamaClientService;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class ExerciseService {

    private static final String KEY_SCORE = "score";

    private final OllamaClientService ollamaClientService;
    private final PhraseTaxonomy taxonomy;

    public ExerciseService(OllamaClientService ollamaClientService, PhraseTaxonomy taxonomy) {
        this.ollamaClientService = ollamaClientService;
        this.taxonomy = taxonomy;
    }

    public String generatePhrase(String lang, String level) {
        String wc = switch (level) {
            case "A1" -> "fr".equals(lang) ? "4-6 mots" : "4-6 words";
            case "A2" -> "fr".equals(lang) ? "6-8 mots" : "6-8 words";
            case "B1" -> "fr".equals(lang) ? "9-12 mots" : "9-12 words";
            case "B2" -> "fr".equals(lang) ? "12-15 mots" : "12-15 words";
            case "C1" -> "fr".equals(lang) ? "15-18 mots" : "15-18 words";
            default -> "fr".equals(lang) ? "18-22 mots" : "18-22 words";
        };

        String system;
        String prompt;
        if ("fr".equals(lang)) {
            system = "Tu g\u00e9n\u00e8res UNE phrase fran\u00e7aise parl\u00e9e, niveau " + level + ". " +
                    "INTERDIT : explications, guillemets, tirets, num\u00e9ros, m\u00e9ta-commentaires. " +
                    "R\u00e9ponds UNIQUEMENT avec la phrase, rien d'autre.";
            prompt = "G\u00e9n\u00e8re une phrase fran\u00e7aise de " + wc
                    + " sur un sujet quotidien (voyage, nourriture, famille, travail, m\u00e9t\u00e9o, sport).";
        } else {
            system = "You generate ONE spoken English sentence, level " + level + ". " +
                    "FORBIDDEN: explanations, quotes, dashes, numbers, meta-comments. " +
                    "Reply with the sentence ONLY, nothing else.";
            prompt = "Generate an English sentence of " + wc
                    + " about a daily topic (travel, food, family, work, weather, sport).";
        }

        String raw = ollamaClientService.callOllama(system, prompt, 40, 0.85);
        String cleaned = raw.split("\n")[0].trim()
                .replaceAll("^[\\d]+[.)\\-\\s]+", "")
                .replaceAll("^[\\\"'\\u00AB\\u00BB\\-*#\\u2022]+", "")
                .replaceAll("[\\\"'\\u00AB\\u00BB]+$", "")
                .replaceAll("[.!?]+$", "")
                .trim();
        
        if (taxonomy.isHallucination(cleaned, lang)) {
            return taxonomy.getFallback(lang, level, "general");
        }
        return cleaned;
    }

    public String generateExercises(String lang, String level, String type, int count) {
        boolean fr = "fr".equals(lang);
        String typeLabel = fr ? switch (type) {
            case "grammar" -> "grammaire";
            case "vocabulary" -> "vocabulaire";
            case "pronunciation" -> "prononciation";
            case "listening" -> "compr\u00e9hension orale";
            default -> type;
        } : type;

        String system = fr
                ? "Tu es un g\u00e9n\u00e9rateur d'exercices p\u00e9dagogiques. R\u00e9ponds UNIQUEMENT avec un tableau JSON valide, rien d'autre."
                : "You are an educational exercise generator. Reply ONLY with a valid JSON array, nothing else.";

        String prompt = fr
                ? String.format(
                        "G\u00e9n\u00e8re %d exercices de %s en fran\u00e7ais pour le niveau CECR %s.\n" +
                                "Format JSON : [{\"question\":\"...\",\"options\":[\"A\",\"B\",\"C\",\"D\"],\"correct\":\"A\",\"explanation\":\"...\"}]",
                        count, typeLabel, level)
                : String.format(
                        "Generate %d %s exercises in English for CEFR level %s.\n" +
                                "JSON format: [{\"question\":\"...\",\"options\":[\"A\",\"B\",\"C\",\"D\"],\"correct\":\"A\",\"explanation\":\"...\"}]",
                        count, typeLabel, level);

        return ollamaClientService.callOllama(system, prompt, 600, 0.6);
    }

    public String generateExercisePhrases(String lang, String level, int count) {
        boolean fr = "fr".equals(lang);
        String system = fr
                ? "Tu g\u00e9n\u00e8res des phrases de pratique orale. R\u00e9ponds UNIQUEMENT avec un tableau JSON valide, rien d'autre."
                : "You generate spoken practice phrases. Reply ONLY with a valid JSON array, nothing else.";

        String prompt = fr
                ? String.format(
                        "G\u00e9n\u00e8re %d phrases fran\u00e7aises de pratique orale pour le niveau CECR %s.\n" +
                                "Format JSON : [\"phrase1\",\"phrase2\",...]",
                        count, level)
                : String.format(
                        "Generate %d English spoken practice phrases for CEFR level %s.\n" +
                                "JSON format: [\"phrase1\",\"phrase2\",...]",
                        count, level);

        return ollamaClientService.callOllama(system, prompt, 400, 0.75);
    }

    public String adaptNextStep(String lang, String level, String targetSound,
            int lastScore, String lastPhrase, List<String> weakSounds) {
        boolean fr = "fr".equals(lang);
        String weakHint = "";
        if (weakSounds != null && !weakSounds.isEmpty()) {
            String prefix = fr ? " Sons faibles : " : " Weak sounds: ";
            weakHint = prefix + String.join(", ", weakSounds) + ".";
        }

        String system = fr
                ? "Tu es un g\u00e9n\u00e9rateur de phrases de pratique orale. R\u00e9ponds UNIQUEMENT en JSON valide, rien d'autre."
                : "You are a spoken practice phrase generator. Reply ONLY with valid JSON, nothing else.";

        String prompt;
        if (fr) {
            prompt = String.format("""
                    G\u00e9n\u00e8re une phrase fran\u00e7aise niveau %s ciblant le son [%s].%s
                    Score pr\u00e9c\u00e9dent : %d/100. Phrase pr\u00e9c\u00e9dente : "%s".
                    Adapte la difficult\u00e9 selon le score (score < 55 \u2192 plus simple, score > 75 \u2192 plus difficile).
                    R\u00e9ponds avec CE JSON exact :
                    {"phrase":"...","target_sound":"%s","tip":"...","difficulty":"..."}""",
                    level, targetSound, weakHint, lastScore, lastPhrase, targetSound);
        } else {
            prompt = String.format("""
                    Generate an English sentence at level %s targeting the sound [%s].%s
                    Previous score: %d/100. Previous phrase: "%s".
                    Adapt difficulty based on score (score < 55 \u2192 easier, score > 75 \u2192 harder).
                    Reply with EXACTLY this JSON:
                    {"phrase":"...","target_sound":"%s","tip":"...","difficulty":"..."}""",
                    level, targetSound, weakHint, lastScore, lastPhrase, targetSound);
        }

        return ollamaClientService.callOllama(system, prompt, 120, 0.7);
    }

    public String generatePlannerSummary(String lang, String level,
            List<Map<String, Object>> stepResults) {
        boolean fr = "fr".equals(lang);

        StringBuilder sb = new StringBuilder();
        for (Map<String, Object> r : stepResults) {
            sb.append(String.format("  son=%s score=%s%n",
                    r.getOrDefault("targetSound", r.getOrDefault("target_sound", "?")),
                    r.getOrDefault(KEY_SCORE, "?")));
        }

        String system = fr
                ? "Tu es un coach p\u00e9dagogique. R\u00e9ponds UNIQUEMENT en JSON valide, rien d'autre."
                : "You are a pedagogical coach. Reply ONLY with valid JSON, nothing else.";

        String prompt;
        if (fr) {
            prompt = String.format("""
                    Voici les r\u00e9sultats d'une session de prononciation niveau %s :
                    %s
                    G\u00e9n\u00e8re un bilan JSON avec CE format exact :
                    {"mastered":["son1"],"to_work":["son2"],"encouragement":"...","next_focus":"..."}""",
                    level, sb);
        } else {
            prompt = String.format("""
                    Here are the results of a level %s pronunciation session:
                    %s
                    Generate a summary JSON with EXACTLY this format:
                    {"mastered":["sound1"],"to_work":["sound2"],"encouragement":"...","next_focus":"..."}""",
                    level, sb);
        }

        return ollamaClientService.callOllama(system, prompt, 200, 0.4);
    }
}
