package com.example.prononciationtest.service.pronunciation;

import com.example.prononciationtest.service.PhraseTaxonomy;
import com.example.prononciationtest.service.ai.OllamaClientService;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class LevelTestService {

    private static final String KEY_SCORE = "score";
    private static final String SUFFIX_SCORE_100 = "/100)";

    private final OllamaClientService ollamaClientService;
    private final PhraseTaxonomy taxonomy;
    private final ConcurrentHashMap<String, String> feedbackCache = new ConcurrentHashMap<>();

    public LevelTestService(OllamaClientService ollamaClientService, PhraseTaxonomy taxonomy) {
        this.ollamaClientService = ollamaClientService;
        this.taxonomy = taxonomy;
    }

    public String generateLevelTestPhrase(String lang, String soundContext, String level) {
        String[] words = soundContext.split(",");
        String w0 = words[0].strip();
        String w1 = words.length > 1 ? words[1].strip() : w0;
        String w2 = words.length > 2 ? words[2].strip() : w0;

        String cefrSpec = "fr".equals(lang) ? switch (level) {
            case "A1" -> "niveau CECR A1 : 2-3 phrases (15-20 mots), présent simple, vocabulaire d'entreprise basique (bureau, réunion, équipe). TOUJOURS dans un contexte professionnel sérieux.";
            case "A2" -> "niveau CECR A2 : paragraphe de 20-30 mots, verbes professionnels, routines de travail en entreprise. AUCUN vocabulaire familier ou d'enfant.";
            case "B1" -> "niveau CECR B1 : paragraphe de 30-45 mots, vocabulaire corporate (gestion de projet, IT, développement).";
            case "B2" -> "niveau CECR B2 : paragraphe de 45-60 mots, structures complexes, vocabulaire métier précis (agile, architecture, stratégie).";
            case "C1" -> "niveau CECR C1 : paragraphe de 60-80 mots, vocabulaire très soutenu, expressions corporate idiomatiques, contexte d'entreprise pointu.";
            case "C2" -> "niveau CECR C2 : paragraphe de 80-100 mots, registre expert, enjeux stratégiques, technologiques et management de haut niveau.";
            default -> "niveau CECR B1 : paragraphe professionnel de 30-45 mots";
        } : switch (level) {
            case "A1" -> "CEFR A1: 2-3 sentences (15-20 words), present simple, basic corporate vocabulary (office, meeting). ALWAYS in a serious business context.";
            case "A2" -> "CEFR A2: paragraph of 20-30 words, professional verbs, corporate work routines. NO casual or childish vocabulary.";
            case "B1" -> "CEFR B1: paragraph of 30-45 words, corporate vocabulary (project management, IT, development).";
            case "B2" -> "CEFR B2: paragraph of 45-60 words, complex structures, precise business vocabulary (agile, architecture, strategy).";
            case "C1" -> "CEFR C1: paragraph of 60-80 words, highly sophisticated corporate grammar, natural business idioms.";
            case "C2" -> "CEFR C2: paragraph of 80-100 words, expert register, strategic and technological challenges at the executive level.";
            default -> "CEFR B1: professional paragraph of 30-45 words";
        };

        String system = "fr".equals(lang)
                ? "Tu génères UN texte parlé professionnel, " + cefrSpec + ". Le texte doit contenir au moins 2 des mots cibles. "
                  + "Termine TOUJOURS par un point. INTERDIT : introduction, guillemets, explication. Réponds UNIQUEMENT avec le texte."
                : "Generate ONE professional spoken text, " + cefrSpec + ". The text must contain at least 2 target words. "
                  + "ALWAYS end with a period. FORBIDDEN: introduction, quotes, explanation. Reply with the text ONLY.";
        String prompt = "fr".equals(lang)
                ? "Mots cibles : " + w0 + ", " + w1 + ", " + w2 + ". Texte :"
                : "Target words: " + w0 + ", " + w1 + ", " + w2 + ". Text:";

        // Tokens adaptés au niveau pour ne jamais couper une phrase
        int maxTokens = switch (level) {
            case "A1" -> 80;
            case "A2" -> 120;
            case "B1" -> 180;
            case "B2" -> 250;
            case "C1" -> 320;
            case "C2" -> 400;
            default   -> 180;
        };

        String raw = ollamaClientService.callOllama(system, prompt, maxTokens, 0.7);
        String cleaned = cleanLevelTestPhrase(raw);
        // Ajoute un point final si la phrase est coupée
        if (!cleaned.isEmpty() && !cleaned.matches(".*[.!?]$")) {
            cleaned = cleaned + ".";
        }
        if (cleaned.length() < 8 || taxonomy.isHallucination(cleaned, lang) || cleaned.contains("indisponible")) {
            return taxonomy.getFallback(lang, level, "general");
        }
        return cleaned;
    }

    public String generateLevelTestTip(String lang, String soundLabel) {
        String system = "fr".equals(lang)
                ? "Coach prononciation. Réponds avec UNE phrase de conseil pratique, max 15 mots, sans tiret ni numéro."
                : "Pronunciation coach. Reply with ONE practical tip, max 15 words, no dash or number.";
        String prompt = "fr".equals(lang)
                ? "Conseil articulatoire pour " + soundLabel + ":"
                : "Articulation tip for " + soundLabel + ":";
        String raw = ollamaClientService.callOllama(system, prompt, 35, 0.35);
        return raw.length() > 10 ? raw : "";
    }

    public String generateLevelTestFeedback(String lang, String soundLabel,
            String contextWords, String phrase, int score, String userName) {
        String cacheKey = lang + "_" + soundLabel + "_" + (score / 10);
        String cached = feedbackCache.get(cacheKey);
        if (cached != null) {
            return cached;
        }

        String learner = (userName != null && !userName.isBlank()) ? userName : "apprenant";
        String perf = getPerformanceLabel(lang, score);

        String prompt = "fr".equals(lang)
                ? "Tu es un coach de prononciation bienveillant. L'apprenant s'appelle " + learner
                        + " et vient de prononcer : « " + phrase + "».\n"
                        + "Son ciblé : " + soundLabel + " (exemples : " + contextWords + ").\nPerformance : " + perf
                        + ".\n"
                        + "Donne un retour personnalisé en 2-3 phrases courtes : mentionne le son « " + soundLabel
                        + "», donne un conseil pratique, encourage. Pas de tirets ni numéros."
                : "You are a supportive pronunciation coach. The learner's name is " + learner
                        + " and they just pronounced: \"" + phrase + "\".\n"
                        + "Target sound: " + soundLabel + " (examples: " + contextWords + ").\nPerformance: " + perf
                        + ".\n"
                        + "Give personalized feedback in 2-3 short sentences: mention the sound \"" + soundLabel
                        + "\", give a practical tip, encourage. No dashes or numbers.";

        String system = "fr".equals(lang)
                ? "Tu es un coach de prononciation. INTERDIT d'utiliser le nom Alex. Appelle l'apprenant uniquement par son prenom: "
                        + learner + ". Reponds en 2-3 phrases courtes. Pas de tirets."
                : "You are a pronunciation coach. FORBIDDEN to use the name Alex. Address the learner only by their name: "
                        + learner + ". Reply in 2-3 short sentences. No dashes.";
        
        String raw = ollamaClientService.callOllama(system, prompt, 55, 0.4);
        raw = raw.replaceAll("(?i)\\bAlex\\b", learner);
        String result = raw.length() > 20 ? raw : buildLevelTestFeedbackFallback(lang, soundLabel, contextWords, score);
        if (feedbackCache.size() < 200) {
            feedbackCache.put(cacheKey, result);
        }
        return result;
    }

    public String generateLevelTestSynthesis(String lang,
            List<Map<String, Object>> history,
            String finalLevel) {
        StringBuilder lines = new StringBuilder();
        int total = 0;
        int count = 0;
        for (Map<String, Object> h : history) {
            int sc = h.get(KEY_SCORE) instanceof Number n ? n.intValue() : 0;
            total += sc;
            count++;
            lines.append("- ").append(h.getOrDefault("sound_label", "?"))
                    .append(": ").append(sc).append("/100\n");
        }
        int avg = count > 0 ? total / count : 0;

        String prompt = "fr".equals(lang)
                ? "Tu es un coach de prononciation. Niveau final : " + finalLevel + ".\nR\u00e9sultats :\n" + lines
                        + "\u00e9cris un bilan encourageant en 3-4 phrases. Cite les points forts et ce qui peut \u00eatre am\u00e9lior\u00e9. Pas de tirets ni num\u00e9ros."
                : "You are a pronunciation coach. Final level: " + finalLevel + ".\nResults:\n" + lines
                        + "Write an encouraging summary in 3-4 sentences. Mention strengths and areas to improve. No dashes or numbers.";

        String raw = ollamaClientService.callOllama("", prompt, 150, 0.4);
        if (raw.length() > 20) {
            return raw;
        }

        return getLevelTestSynthesisFallback(lang, finalLevel, avg);
    }

    private String getPerformanceLabel(String lang, int score) {
        if ("fr".equals(lang)) {
            if (score >= 75) {
                return "très bonne (score " + score + SUFFIX_SCORE_100;
            } else if (score >= 55) {
                return "correcte (score " + score + SUFFIX_SCORE_100;
            } else {
                return "à améliorer (score " + score + SUFFIX_SCORE_100;
            }
        } else {
            if (score >= 75) {
                return "very good (score " + score + SUFFIX_SCORE_100;
            } else if (score >= 55) {
                return "decent (score " + score + SUFFIX_SCORE_100;
            } else {
                return "needs work (score " + score + SUFFIX_SCORE_100;
            }
        }
    }

    private String getLevelTestSynthesisFallback(String lang, String finalLevel, int avg) {
        if ("fr".equals(lang)) {
            if (avg >= 75) {
                return "Tr\u00e9s bon niveau (" + finalLevel + ") ! Tu es sur la bonne voie.";
            }
            if (avg >= 55) {
                return "Bon niveau g\u00e9n\u00e9ral (" + finalLevel + "). Quelques sons m\u00e9ritent plus de pratique.";
            }
            return "Des bases solides \u00e0 renforcer. Pratique r\u00e9guli\u00e8rement les sons cibl\u00e9s pour progresser.";
        } else {
            if (avg >= 75) {
                return "Very good pronunciation (" + finalLevel + ")! Keep up the great work.";
            }
            if (avg >= 55) {
                return "Good overall level (" + finalLevel + "). A few sounds need more practice.";
            }
            return "Solid foundations at " + finalLevel + ". Keep practicing the target sounds regularly.";
        }
    }

    private boolean isCodeOrInvalidLine(String lower) {
        if (lower.contains("reactdom.render") || lower.contains("import ") || lower.contains("export ") || lower.contains(";")) {
            return true;
        }
        if (lower.contains("<") && lower.contains(">")) {
            return true;
        }
        if (lower.contains("{") && lower.contains("}")) {
            return true;
        }
        return lower.matches(".*\\b(function\\s+\\w+|class\\s+\\w+).*");
    }

    private String cleanLevelTestPhrase(String raw) {
        if (raw == null || raw.isBlank()) {
            return "";
        }
        for (String rawLine : raw.strip().split("\n")) {
            String line = rawLine.strip();
            if (line.isBlank()) {
                continue;
            }
            line = line.replaceAll("^[\\-\\*\\d\\.\\)]+\\s*", "");
            line = line.replaceAll("(^[\\\"'\\u00AB\\u00BB\\u201C\\u201D\\u201E]+)|([\\\"'\\u00AB\\u00BB\\u201C\\u201D\\u201E]+$)", "");
            if (line.contains(":") && line.indexOf(':') < 20) {
                line = line.substring(line.indexOf(':') + 1).strip();
            }
            String lower = line.toLowerCase();
            if (!isCodeOrInvalidLine(lower) && line.length() > 10) {
                return line;
            }
        }
        return raw.strip();
    }

    private String buildLevelTestFeedbackFallback(String lang, String soundLabel,
            String contextWords, int score) {
        String w0 = contextWords.split(",")[0].trim();
        if ("fr".equals(lang)) {
            if (score >= 75) {
                return "Excellent ! Tu prononces tr\u00e8s bien le son " + soundLabel + ". Continue ! \ud83c\udf89";
            }
            if (score >= 55) {
                return "Bien jou\u00e9 ! Le son " + soundLabel + " est presque parfait. R\u00e9p\u00e8te : " + w0 + " \ud83d\udc4d";
            }
            return "Le son " + soundLabel + " est difficile. Entra\u00eene-toi avec : " + w0 + ". \u00c7a viendra ! \ud83d\udcaa";
        } else {
            if (score >= 75) {
                return "Excellent! You nailed the " + soundLabel + " sound. Keep it up! \ud83c\udf89";
            }
            if (score >= 55) {
                return "Well done! The " + soundLabel + " is almost perfect. Practice: " + w0 + " \ud83d\udc4d";
            }
            return "The " + soundLabel + " is challenging. Practice: " + w0 + ". You'll get there! \ud83d\udcaa";
        }
    }
}
