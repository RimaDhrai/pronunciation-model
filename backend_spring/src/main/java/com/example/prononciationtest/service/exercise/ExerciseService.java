package com.example.prononciationtest.service.exercise;

import com.example.prononciationtest.service.PhraseTaxonomy;
import com.example.prononciationtest.service.ai.OllamaClientService;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * Service de génération des exercices de prononciation.
 *
 * Thèmes : Réunions professionnelles, présentations client, architecture IT,
 *          gestion de projet, communication d'entreprise, KPIs.
 */
@Service
public class ExerciseService {

    private static final String KEY_SCORE = "score";

    private final OllamaClientService ollamaClientService;
    private final PhraseTaxonomy taxonomy;

    public ExerciseService(OllamaClientService ollamaClientService, PhraseTaxonomy taxonomy) {
        this.ollamaClientService = ollamaClientService;
        this.taxonomy = taxonomy;
    }

    // ── Génération de phrase de pratique orale ─────────────────────────────────
    public String generatePhrase(String lang, String level) {
        String wc = switch (level) {
            case "A1" -> "fr".equals(lang)
                    ? "1 à 2 phrases simples et complètes (8-12 mots), contexte bureau ou équipe"
                    : "1-2 simple complete sentences (8-12 words), office or team context";
            case "A2" -> "fr".equals(lang)
                    ? "2 phrases complètes (12-18 mots), réunion d'équipe ou organisation du travail"
                    : "2 complete sentences (12-18 words), team meeting or work organization";
            case "B1" -> "fr".equals(lang)
                    ? "2 phrases complètes (20-30 mots), gestion de projet ou relation client"
                    : "2 complete sentences (20-30 words), project management or client relationship";
            case "B2" -> "fr".equals(lang)
                    ? "3 phrases complètes (30-45 mots), présentation stratégique ou architecture IT"
                    : "3 complete sentences (30-45 words), strategic presentation or IT architecture";
            case "C1" -> "fr".equals(lang)
                    ? "3 à 4 phrases complètes (45-60 mots), offre commerciale ou transformation digitale"
                    : "3-4 complete sentences (45-60 words), commercial offer or digital transformation";
            default -> "fr".equals(lang)
                    ? "4 à 5 phrases complètes (60+ mots), enjeux stratégiques et technologiques"
                    : "4-5 complete sentences (60+ words), strategic and technological challenges";
        };

        String system;
        String prompt;
        if ("fr".equals(lang)) {
            system = "Tu es un formateur expert en communication orale professionnelle. " +
                     "Tu génères du texte parlé professionnel en français, niveau CECR " + level + ". " +
                     "Thèmes : présentation client, réunion d'équipe, gestion de projet, " +
                     "suivi budgétaire, livrables, parties prenantes, transformation digitale, ROI. " +
                     "INTERDIT : vocabulaire enfantin, sujets généraux, explications, guillemets, tirets, puces. " +
                     "Réponds UNIQUEMENT avec le texte à prononcer, rien d'autre.";
            prompt = "Génère un texte de " + wc +
                     " représentant une situation professionnelle courante en entreprise " +
                     "(ex: présentation à la direction, réunion client, revue de projet, démonstration produit, négociation commerciale).";
        } else {
            system = "You are an expert professional oral communication trainer. " +
                     "You generate professional spoken English text at CEFR level " + level + ". " +
                     "Topics: client presentations, team meetings, project management, " +
                     "budget tracking, deliverables, stakeholders, digital transformation, ROI. " +
                     "FORBIDDEN: childish vocabulary, general topics, explanations, quotes, dashes, bullets. " +
                     "Reply with the spoken text ONLY, nothing else.";
            prompt = "Generate a text of " + wc +
                     " representing a common professional situation in a company " +
                     "(e.g. executive presentation, client meeting, project review, product demo, business negotiation).";
        }

        // Nombre de tokens adapté au niveau pour ne jamais couper la phrase
        int maxTokens = switch (level) {
            case "A1" -> 60;
            case "A2" -> 90;
            case "B1" -> 150;
            case "B2" -> 220;
            case "C1" -> 300;
            default   -> 380;
        };

        if ("fr".equals(lang)) {
            system += " Termine TOUJOURS par un point. Ne coupe jamais une phrase à mi-chemin.";
        } else {
            system += " ALWAYS end with a period. Never cut a sentence in the middle.";
        }

        String raw = ollamaClientService.callOllama(system, prompt, maxTokens, 0.80);
        String cleaned = raw.split("\n")[0].trim()
                .replaceAll("^[\\d]+[.)\\-\\s]+", "")
                .replaceAll("^[\\\"'\\u00AB\\u00BB\\-*#\\u2022]+", "")
                .replaceAll("[\\\"'\\u00AB\\u00BB]+$", "")
                .trim();

        // Ajoute un point final si la phrase n'en a pas
        if (!cleaned.isEmpty() && !cleaned.matches(".*[.!?]$")) {
            cleaned = cleaned + ".";
        }

        if (taxonomy.isHallucination(cleaned, lang)) {
            return taxonomy.getFallback(lang, level, "general");
        }
        return cleaned;
    }

    // ── Génération d'exercices QCM (grammaire, vocabulaire, etc.) ─────────────
    public String generateExercises(String lang, String level, String type, int count) {
        boolean fr = "fr".equals(lang);
        String typeLabel = fr ? switch (type) {
            case "grammar"       -> "grammaire professionnelle";
            case "vocabulary"    -> "vocabulaire corporate et IT";
            case "pronunciation" -> "prononciation en contexte professionnel";
            case "listening"     -> "compréhension orale en réunion";
            default              -> type;
        } : switch (type) {
            case "grammar"       -> "professional grammar";
            case "vocabulary"    -> "corporate and IT vocabulary";
            case "pronunciation" -> "pronunciation in professional context";
            case "listening"     -> "listening comprehension in meetings";
            default              -> type;
        };

        String system = fr
                ? "Tu es un concepteur d'exercices de communication professionnelle en entreprise. " +
                  "Réponds UNIQUEMENT avec un tableau JSON valide, rien d'autre."
                : "You are a professional business communication exercise designer. " +
                  "Reply ONLY with a valid JSON array, nothing else.";

        String prompt = fr
                ? String.format(
                    "Génère %d exercices de %s en français (niveau CECR %s) basés sur des situations réelles " +
                    "en entreprise : réunions d'équipe, présentations client, gestion de projet, " +
                    "transformation digitale, négociation commerciale, communication interne.%n" +
                    "Format JSON : [{\"question\":\"...\",\"options\":[\"A\",\"B\",\"C\",\"D\"],\"correct\":\"A\",\"explanation\":\"...\"}]",
                    count, typeLabel, level)
                : String.format(
                    "Generate %d %s exercises in English (CEFR level %s) based on real business situations: " +
                    "team meetings, client presentations, project management, " +
                    "digital transformation, business negotiation, internal communication.%n" +
                    "JSON format: [{\"question\":\"...\",\"options\":[\"A\",\"B\",\"C\",\"D\"],\"correct\":\"A\",\"explanation\":\"...\"}]",
                    count, typeLabel, level);

        return ollamaClientService.callOllama(system, prompt, 800, 0.55);
    }

    // ── Génération de phrases de pratique orale (JSON array) ──────────────────
    public String generateExercisePhrases(String lang, String level, int count) {
        boolean fr = "fr".equals(lang);
        String system = fr
                ? "Tu génères des phrases de pratique orale pour des professionnels en entreprise, " +
                  "lors de réunions, présentations ou échanges avec des clients. " +
                  "Réponds UNIQUEMENT avec un tableau JSON valide."
                : "You generate spoken practice phrases for business professionals " +
                  "in meetings, presentations or client interactions. Reply ONLY with a valid JSON array.";

        String prompt = fr
                ? String.format(
                    "Génère %d phrases professionnelles de pratique orale en français (niveau CECR %s) " +
                    "adaptées à un contexte d'entreprise. Thèmes : réunions d'équipe, présentations client, " +
                    "gestion de projet, suivi des objectifs, communication avec la direction, négociation.%n" +
                    "Format JSON : [\"phrase1\",\"phrase2\",...]",
                    count, level)
                : String.format(
                    "Generate %d professional English spoken practice phrases (CEFR level %s) " +
                    "adapted to a business environment. Topics: team meetings, client presentations, " +
                    "project management, goal tracking, management communication, negotiation.%n" +
                    "JSON format: [\"phrase1\",\"phrase2\",...]",
                    count, level);

        return ollamaClientService.callOllama(system, prompt, 600, 0.70);
    }

    // ── Adaptation du prochain exercice (planner adaptatif) ───────────────────
    public String adaptNextStep(String lang, String level, String targetSound,
            int lastScore, String lastPhrase, List<String> weakSounds) {
        boolean fr = "fr".equals(lang);
        String weakHint = "";
        if (weakSounds != null && !weakSounds.isEmpty()) {
            String prefix = fr ? " Sons à travailler : " : " Sounds to work on: ";
            weakHint = prefix + String.join(", ", weakSounds) + ".";
        }

        String system = fr
                ? "Tu génères des phrases de pratique orale pour des professionnels en entreprise. " +
                  "Réponds UNIQUEMENT en JSON valide, rien d'autre."
                : "You generate spoken practice phrases for business professionals. " +
                  "Reply ONLY with valid JSON, nothing else.";

        String prompt;
        if (fr) {
            prompt = String.format("""
                    Génère une phrase professionnelle en entreprise (réunion d'équipe, présentation client, suivi de projet) \
                    niveau %s ciblant le son [%s].%s
                    Score précédent : %d/100. Phrase précédente : "%s".
                    Adapte la difficulté selon le score (si <60 : simplifie ; si >80 : enrichis le vocabulaire professionnel).
                    Réponds avec CE JSON exact :
                    {"phrase":"...","target_sound":"%s","tip":"...","difficulty":"..."}""",
                    level, targetSound, weakHint, lastScore, lastPhrase, targetSound);
        } else {
            prompt = String.format("""
                    Generate a professional business phrase (team meeting, client presentation, project follow-up) \
                    at level %s targeting the sound [%s].%s
                    Previous score: %d/100. Previous phrase: "%s".
                    Adapt difficulty based on score (if <60: simplify; if >80: enrich with professional vocabulary).
                    Reply with EXACTLY this JSON:
                    {"phrase":"...","target_sound":"%s","tip":"...","difficulty":"..."}""",
                    level, targetSound, weakHint, lastScore, lastPhrase, targetSound);
        }

        return ollamaClientService.callOllama(system, prompt, 150, 0.65);
    }

    // ── Bilan de session (planner summary) ────────────────────────────────────
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
                ? "Tu es un coach pédagogique expert en communication professionnelle. Réponds UNIQUEMENT en JSON valide, rien d'autre."
                : "You are a pedagogical coach expert in professional communication. Reply ONLY with valid JSON, nothing else.";

        String prompt;
        if (fr) {
            prompt = String.format("""
                    Voici les résultats d'une session de prononciation niveau %s :
                    %s
                    Génère un bilan JSON encourageant adapté à un contexte professionnel, avec CE format exact :
                    {"mastered":["son1"],"to_work":["son2"],"encouragement":"...","next_focus":"..."}""",
                    level, sb);
        } else {
            prompt = String.format("""
                    Here are the results of a level %s pronunciation session:
                    %s
                    Generate an encouraging JSON summary adapted to a professional context, with EXACTLY this format:
                    {"mastered":["sound1"],"to_work":["sound2"],"encouragement":"...","next_focus":"..."}""",
                    level, sb);
        }

        return ollamaClientService.callOllama(system, prompt, 250, 0.40);
    }
}
