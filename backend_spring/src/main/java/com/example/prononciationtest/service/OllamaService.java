package com.example.prononciationtest.service;

import com.example.prononciationtest.service.iservice.IOllamaService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.http.*;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Consumer;

@Service
public class OllamaService implements IOllamaService {

    private static final Logger log = LoggerFactory.getLogger(OllamaService.class);

    @Value("${ollama.base-url:#{'http://localhost:11434'}}")
    private String ollamaBaseUrl;

    @Value("${ollama.model:#{'qwen2.5:3b'}}")
    private String ollamaModel;

    @Value("${ollama.model.chatbot:#{'qwen2.5:3b'}}")
    private String chatbotModel;

    @Value("${azure.openai.enabled:false}")
    private boolean azureEnabled;

    @Value("${azure.openai.endpoint:}")
    private String azureEndpoint;

    @Value("${azure.openai.key:}")
    private String azureKey;

    @Value("${azure.openai.deployment:gpt-4.1-mini}")
    private String azureDeployment;

    private static final String AZURE_API_VERSION = "2025-01-01-preview";

    // SonarQube constants
    private static final String KEY_SCORE = "score";
    private static final String KEY_CONTENT = "content";
    private static final String KEY_STREAM = "stream";
    private static final String KEY_TEMPERATURE = "temperature";
    private static final String KEY_MESSAGES = "messages";
    private static final String KEY_MESSAGE = "message";
    private static final String REGEX_THINK = "(?i)<think>[\\s\\S]*?</think>";
    private static final String PATH_AZURE_DEPLOYMENTS = "/openai/deployments/";
    private static final String PATH_AZURE_COMPLETIONS = "/chat/completions?api-version=";
    private static final String HEADER_AZURE_KEY = "api-key";
    private static final String KEY_MAX_TOKENS = "max_tokens";
    private static final String KEY_MODEL = "model";
    private static final String LITERAL_100 = "/100)";

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final PhraseTaxonomy taxonomy;
    private final ConcurrentHashMap<String, String> feedbackCache = new ConcurrentHashMap<>();

    public OllamaService(RestTemplate restTemplate, ObjectMapper objectMapper, PhraseTaxonomy taxonomy) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
        this.taxonomy = taxonomy;
    }

    @Async
    @EventListener(ApplicationReadyEvent.class)
    public void warmupOllama() {
        if (azureEnabled) {
            log.info("[Azure OpenAI] enabled - skipping Ollama warmup.");
            return;
        }
        try {
            callOllama("You are a helpful assistant.", "Hi", 1, 0.0);
            log.info("[Ollama] Warmup OK - model loaded in memory.");
        } catch (Exception e) {
            log.warn("[Ollama] Warmup skipped (Ollama not started): {}", e.getMessage());
        }
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

        String raw = callOllama(system, prompt, 40, 0.85);
        String cleaned = raw.split("\n")[0].trim()
                .replaceAll("^[\\d]+[.)\\-\\s]+", "")
                .replaceAll("^[\"'\\u00AB\\u00BB\\-*#\\u2022]+", "")
                .replaceAll("[\"'\\u00AB\\u00BB]+$", "")
                .replaceAll("[.!?]+$", "")
                .trim();
        // Use taxonomy fallback when Ollama hallucinates
        if (taxonomy.isHallucination(cleaned, lang)) {
            return taxonomy.getFallback(lang, level, "general");
        }
        return cleaned;
    }

    public String feedback(String expectedPhrase, String transcription, int score, String lang) {
        String cleanTranscription = (transcription != null) ? transcription.trim() : "";
        Map<String, Object> scoreResult = PythonSttClient.getScoreDetail(expectedPhrase, cleanTranscription);

        StringBuilder errors = new StringBuilder();

        @SuppressWarnings("unchecked")
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
                    default -> { /* ignore other operations */ }
                }
            }
        }
        Boolean hallucination = (Boolean) scoreResult.get("suspected_hallucination");
        int nExpected = scoreResult.containsKey("n_expected") ? ((Number) scoreResult.get("n_expected")).intValue() : 0;
        int nMatch = scoreResult.containsKey("n_match") ? ((Number) scoreResult.get("n_match")).intValue() : 0;

        if (Boolean.TRUE.equals(hallucination)) {
            errors.insert(0, "  - \u26A0\uFE0F Halucination suspect\u00e9e (les phrases sont trop diff\u00e9rentes)\n");
        } else if (nMatch < nExpected && nExpected > 0) {
            String halNote = "fr".equals(lang)
                    ? String.format("  - \u26A0\uFE0F L'apprenant n'a probablement dit que %d/%d mots de la phrase%n",
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
                        scoreResult.get(KEY_SCORE), expectedPhrase, cleanTranscription, scoreResult.get(KEY_SCORE), errors)
                : String.format("Level %s%nExpected: \"%s\"%nTranscribed: \"%s\"%nScore: %s/100%nDetails:%n%s",
                        scoreResult.get(KEY_SCORE), expectedPhrase, cleanTranscription, scoreResult.get(KEY_SCORE), errors);

        return stripEmojis(callOllama(systemPrompt, userMsg, 160, 0.3));
    }

    public String generateChatbotResponse(
            List<Map<String, String>> history,
            String userText,
            List<String> weakWords,
            Double pronScore,
            String lang,
            String level,
            String scenario) {
        String system = getChatbotSystemPrompt(lang, level, scenario);
        String content = buildChatbotUserContent(userText, weakWords, pronScore, lang);
        List<Map<String, Object>> messages = buildChatbotMessagesList(history, content, system);

        String raw = callOllamaMessages(chatbotModel, messages, 110, 0.65, 1024);
        String cleaned = raw.replaceAll(REGEX_THINK, "").trim();
        return cleaned.isBlank() ? raw.trim() : cleaned;
    }

    public String buildChatbotUserContent(
            String userText, List<String> weakWords, Double pronScore, String lang) {
        String content = (userText == null || userText.isBlank())
                ? "(silence \u2014 encourage user to speak)"
                : userText;
        if (weakWords != null && !weakWords.isEmpty()) {
            String hint = weakWords.stream()
                    .map(w -> "\"" + w + "\"")
                    .collect(java.util.stream.Collectors.joining(", "));
            content += switch (lang) {
                case "en" -> "\n[Uncertain pronunciation: " + hint + "]";
                case "es" -> "\n[Pronunciaci\u00f3n incierta: " + hint + "]";
                case "de" -> "\n[Unsichere Aussprache: " + hint + "]";
                default -> "\n[Prononciation incertaine: " + hint + "]";
            };
        } else if (pronScore != null && pronScore >= 0.80) {
            int pct = (int) (pronScore * 100);
            content += switch (lang) {
                case "en" -> "\n[Pronunciation score: " + pct + "% \u2014 very good!]";
                case "es" -> "\n[Puntuaci\u00f3n: " + pct + "% \u2014 \u00a1muy bien!]";
                case "de" -> "\n[Aussprache-Score: " + pct + "% \u2014 sehr gut!]";
                default -> "\n[Score prononciation: " + pct + "% \u2014 tr\u00e8s bon !]";
            };
        }
        return content;
    }

    public List<Map<String, Object>> buildChatbotMessagesList(
            List<Map<String, String>> history, String userContent, String systemPrompt) {
        List<Map<String, Object>> messages = new ArrayList<>();
        if (systemPrompt != null && !systemPrompt.isBlank()) {
            messages.add(Map.of("role", "system", KEY_CONTENT, systemPrompt));
        }
        if (history != null) {
            for (Map<String, String> h : history) {
                messages.add(Map.of("role", h.get("role"), KEY_CONTENT, h.get(KEY_CONTENT)));
            }
        }
        messages.add(Map.of("role", "user", KEY_CONTENT, userContent));
        return messages;
    }

    // Stream Chatbot Response refactored to drop complexity
    public String streamChatbotResponse(List<Map<String, Object>> messages, Consumer<String> onToken) {
        if (azureEnabled) {
            String raw = streamAzureChatbot(messages, onToken);
            String cleaned = raw.replaceAll(REGEX_THINK, "").trim();
            return cleaned.isBlank() ? raw : cleaned;
        }
        Map<String, Object> body = buildOllamaStreamBody(messages);
        StringBuilder full = new StringBuilder();
        try {
            executeOllamaStream(body, full, onToken);
        } catch (Exception e) {
            if (full.isEmpty()) {
                return "\u26A0\uFE0F R\u00e9ponse indisponible";
            }
        }
        String raw = full.toString().trim();
        String cleaned = raw.replaceAll(REGEX_THINK, "").trim();
        return cleaned.isBlank() ? raw : cleaned;
    }

    private Map<String, Object> buildOllamaStreamBody(List<Map<String, Object>> messages) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put(KEY_MODEL, chatbotModel);
        body.put(KEY_STREAM, true);
        body.put("options", Map.of(KEY_TEMPERATURE, 0.72, "num_predict", 110, "num_ctx", 1024));
        body.put(KEY_MESSAGES, messages);
        return body;
    }

    private void executeOllamaStream(Map<String, Object> body, StringBuilder full, Consumer<String> onToken) {
        restTemplate.execute(
                ollamaBaseUrl + "/api/chat",
                HttpMethod.POST,
                request -> {
                    request.getHeaders().setContentType(MediaType.APPLICATION_JSON);
                    objectMapper.writeValue(request.getBody(), body);
                },
                response -> {
                    try (BufferedReader reader = new BufferedReader(
                            new InputStreamReader(response.getBody(), StandardCharsets.UTF_8))) {
                        String line;
                        while ((line = reader.readLine()) != null) {
                            processStreamLine(line, full, onToken);
                        }
                    }
                    return null;
                });
    }

    private void processStreamLine(String line, StringBuilder full, Consumer<String> onToken) {
        if (!line.isBlank()) {
            try {
                JsonNode node = objectMapper.readTree(line);
                String token = node.path(KEY_MESSAGE).path(KEY_CONTENT).asText("");
                if (!token.isEmpty()) {
                    full.append(token);
                    if (onToken != null) {
                        onToken.accept(token);
                    }
                }
            } catch (Exception ignored) {
                log.debug("Skipping malformed SSE line");
            }
        }
    }

    private String buildRoleplaySystemPrompt(String lang, String level, String scenario) {
        boolean fr = !"en".equals(lang);
        String levelHint = fr ? switch (level) {
            case "A1" -> "utilise des phrases tr\u00e8s simples (max 8 mots)";
            case "A2" -> "utilise des phrases simples et courtes";
            case "B1" -> "utilise un langage courant, clair";
            case "B2" -> "utilise un langage naturel et vari\u00e9";
            default -> "utilise un langage riche et naturel";
        } : switch (level) {
            case "A1" -> "use very simple sentences (max 8 words)";
            case "A2" -> "use simple and short sentences";
            case "B1" -> "use clear conversational language";
            case "B2" -> "use natural and varied language";
            default -> "use rich and complex natural language";
        };

        if (fr) {
            return "Tu es un coach de prononciation fran\u00e7aise chaleureux et interactif. " +
                    "Nous jouons un jeu de rôle d\u00e9fini par ce scenario : \"" + scenario + "\".\n" +
                    "L'apprenant a le niveau " + level + ". R\u00e9ponds en français de mani\u00e8re fluide et " +
                    "naturelle en lien direct avec le sc\u00e9nario. IMPORTANT : " + levelHint + ".\n" +
                    "R\u00e8gles strictes :\n" +
                    "1. R\u00e9ponds en UNE seule phrase de max 15 mots pour garder la conversation active et rapide.\n" +
                    "2. Pose une question courte ou relance \u00e0 la fin pour faire parler l'utilisateur.\n" +
                    "3. JAMAIS d'explications m\u00e9ta-linguistiques, de listes ni d'emojis.\n" +
                    "4. Si l'utilisateur est timide ou silencieux, encourage-le avec bienveillance.";
        } else {
            return "You are a warm, interactive English pronunciation coach. " +
                    "We are roleplaying this scenario: \"" + scenario + "\".\n" +
                    "The learner is at CEFR level " + level + ". Reply in English naturally in character. " +
                    "IMPORTANT: " + levelHint + ".\n" +
                    "Strict rules:\n" +
                    "1. Reply in ONE single sentence of max 15 words to keep the exchange extremely fast.\n" +
                    "2. Ask a short question or prompt the user at the end to keep them speaking.\n" +
                    "3. NEVER use emojis, lists, or meta-pedagogical explanations.\n" +
                    "4. If the user is silent or hesitant, encourage them kindly to speak.";
        }
    }

    public String getChatbotSystemPrompt(String lang, String level, String scenario) {
        if (scenario != null && !scenario.isBlank() && !"general".equalsIgnoreCase(scenario)) {
            return buildRoleplaySystemPrompt(lang, level, scenario);
        }
        if ("fr".equals(lang)) {
            return "Tu es un coach de prononciation fran\u00e7aise bienveillant, interactif et dynamique. " +
                    "L'apprenant a un niveau " + level + ". R\u00e9ponds en fran\u00e7ais.\n" +
                    "R\u00e8gles strictes :\n" +
                    "1. R\u00e9ponds en UNE seule phrase tr\u00e8s courte (max 15 mots) pour que l'échange reste fluide.\n" +
                    "2. Relance toujours l'apprenant \u00e0 la fin par une question ouverte ou une invite \u00e0 parler.\n" +
                    "3. Pas de listes, pas d'explications complexes, pas d'emojis.\n" +
                    "4. Reste chaleureux, encourageant et tr\u00e8s simple.";
        } else {
            return "You are a supportive, highly interactive English pronunciation coach. " +
                    "The learner's CEFR level is " + level + ". Reply in English.\n" +
                    "Strict rules:\n" +
                    "1. Reply in ONE single short sentence (max 15 words) to keep the flow fast.\n" +
                    "2. Always prompt the user at the end with a short question or invite to speak.\n" +
                    "3. No lists, no complex linguistic explanations, no emojis.\n" +
                    "4. Keep it extremely warm, positive, and simple.";
        }
    }

    public String generateLevelTestTip(String lang, String soundLabel) {
        String system = "fr".equals(lang)
                ? "Coach prononciation. R\u00e9ponds avec UNE phrase de conseil pratique, max 15 mots, sans tiret ni num\u00e9ro."
                : "Pronunciation coach. Reply with ONE practical tip, max 15 words, no dash or number.";
        String prompt = "fr".equals(lang)
                ? "Conseil articulatoire pour " + soundLabel + ":"
                : "Articulation tip for " + soundLabel + ":";
        String raw = callOllama(system, prompt, 35, 0.35);
        return raw.length() > 10 ? raw : "";
    }

    // Refactored generateLevelTestFeedback to avoid nested ternaries and reduce complexity
    private String getPerformanceLabel(String lang, int score) {
        boolean fr = "fr".equals(lang);
        if (score >= 75) {
            return fr ? "tr\u00e8s bonne (score " + score + LITERAL_100
                      : "very good (score " + score + LITERAL_100;
        } else if (score >= 55) {
            return fr ? "correcte (score " + score + LITERAL_100
                      : "decent (score " + score + LITERAL_100;
        } else {
            return fr ? "\u00e0 am\u00e9liorer (score " + score + LITERAL_100
                      : "needs work (score " + score + LITERAL_100;
        }
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
                        + " et vient de prononcer : \u00AB " + phrase + "\u00BB.\n"
                        + "Son cibl\u00e9 : " + soundLabel + " (exemples : " + contextWords + ").\nPerformance : " + perf
                        + ".\n"
                        + "Donne un retour personnalis\u00e9 en 2-3 phrases courtes : mentionne le son \u00AB " + soundLabel
                        + "\u00BB, donne un conseil pratique, encourage. Pas de tirets ni num\u00e9ros."
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
        String raw = callOllama(system, prompt, 55, 0.4);
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
                        + "\u00c9cris un bilan encourageant en 3-4 phrases. Cite les points forts et ce qui peut \u00eatre am\u00e9lior\u00e9. Pas de tirets ni num\u00e9ros."
                : "You are a pronunciation coach. Final level: " + finalLevel + ".\nResults:\n" + lines
                        + "Write an encouraging summary in 3-4 sentences. Mention strengths and areas to improve. No dashes or numbers.";

        String raw = callOllama("", prompt, 150, 0.4);
        if (raw.length() > 20) {
            return raw;
        }

        if ("fr".equals(lang)) {
            if (avg >= 75) {
                return "Tr\u00e8s bon niveau (" + finalLevel + ") ! Tu es sur la bonne voie.";
            }
            if (avg >= 55) {
                return "Bon niveau g\u00e9n\u00e9ral (" + finalLevel + "). Quelques sons m\u00e9ritent plus de pratique.";
            }
            return "Des bases solides à renforcer. Pratique régulièrement les sons ciblés pour progresser.";
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

    // Refactored cleanLevelTestPhrase to reduce breaks/continues complexity
    public String cleanLevelTestPhrase(String raw) {
        if (raw == null || raw.isBlank()) {
            return "";
        }
        for (String line : raw.strip().split("\n")) {
            line = line.strip();
            if (!line.isBlank()) {
                line = line.replaceAll("^[\\-\\*\\d\\.\\)]+\\s*", "");
                line = line.replaceAll("(^[\\\"'\\u00AB\\u00BB\\u201C\\u201D\\u201E]+)|([\\\"'\\u00AB\\u00BB\\u201C\\u201D\\u201E]+$)", "");
                if (line.contains(":") && line.indexOf(':') < 20) {
                    line = line.substring(line.indexOf(':') + 1).strip();
                }
                String lower = line.toLowerCase();
                boolean isCode = line.contains(";") || line.contains("{") || line.contains("<") 
                        || lower.contains("reactdom") || lower.contains("function ") 
                        || lower.contains("class ") || lower.contains("import ") 
                        || lower.contains("export ");
                if (!isCode && line.length() > 10) {
                    return line;
                }
            }
        }
        return raw.strip();
    }

    private String buildLevelTestFeedbackFallback(String lang, String soundLabel,
            String contextWords, int score) {
        String w0 = contextWords.split(",")[0].trim();
        if ("fr".equals(lang)) {
            if (score >= 75) {
                return "Excellent ! Tu prononces tr\u00e8s bien le son " + soundLabel + ". Continue ! \u2B50";
            }
            if (score >= 55) {
                return "Bien jou\u00e9 ! Le son " + soundLabel + " est presque parfait. R\u00e9p\u00e8te : " + w0 + " \uD83D\uDC4D";
            }
            return "Le son " + soundLabel + " est difficile. Entra\u00eene-toi avec : " + w0 + ". \u00c7a viendra ! \uD83D\uDCAA";
        } else {
            if (score >= 75) {
                return "Excellent! You nailed the " + soundLabel + " sound. Keep it up! \u2B50";
            }
            if (score >= 55) {
                return "Well done! The " + soundLabel + " is almost perfect. Practice: " + w0 + " \uD83D\uDC4D";
            }
            return "The " + soundLabel + " is challenging. Practice: " + w0 + ". You'll get there! \uD83D\uDCAA";
        }
    }

    public String callRaw(String system, String userPrompt, int maxTokens, double temperature, String expectedLang) {
        String raw = callOllama(system, userPrompt, maxTokens, temperature);
        String cleaned = raw.split("\n")[0].trim()
                .replaceAll("^[\"'\\u00AB\\u00BB\\-*#\\u2022\\d.)+\\s]+", "")
                .replaceAll("[\"'\\u00AB\\u00BB]+$", "")
                .trim();
        return taxonomy.isHallucination(cleaned, expectedLang) ? null : cleaned;
    }

    private String callOllama(String system, String userPrompt, int maxTokens, double temperature) {
        List<Map<String, Object>> messages = system.isBlank()
                ? List.of(Map.of("role", "user", KEY_CONTENT, userPrompt))
                : List.of(
                        Map.of("role", "system", KEY_CONTENT, system),
                        Map.of("role", "user", KEY_CONTENT, userPrompt));
        return callOllamaMessages(ollamaModel, messages, maxTokens, temperature);
    }

    private String callOllamaMessages(String model, List<Map<String, Object>> messages,
            int maxTokens, double temperature) {
        return callOllamaMessages(model, messages, maxTokens, temperature, 1024);
    }

    private String callOllamaMessages(String model, List<Map<String, Object>> messages,
            int maxTokens, double temperature, int numCtx) {
        if (azureEnabled) {
            return callAzureOpenAI(messages, maxTokens, temperature);
        }
        try {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put(KEY_MODEL, model);
            body.put("stream", false);
            body.put("options", Map.of(KEY_TEMPERATURE, temperature, "num_predict", maxTokens, "num_ctx", numCtx));
            body.put(KEY_MESSAGES, messages);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            ResponseEntity<byte[]> response = restTemplate.exchange(
                    ollamaBaseUrl + "/api/chat",
                    HttpMethod.POST,
                    new HttpEntity<>(body, headers),
                    byte[].class);
            JsonNode json = objectMapper.readTree(response.getBody());
            return json.path(KEY_MESSAGE).path(KEY_CONTENT).asText("").trim();
        } catch (Exception e) {
            return "\u26A0\uFE0F R\u00e9ponse indisponible : " + e.getMessage();
        }
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

        return callOllama(system, prompt, 600, 0.6);
    }

    public String generateExerciseFeedback(String lang, String level, String type,
            int score, int correct, int total, String errorsDetail) {
        boolean fr = "fr".equals(lang);
        String system = fr
                ? "Tu es un coach p\u00e9dagogique bienveillant. R\u00e9ponds en 2-3 phrases maximum."
                : "You are an encouraging pedagogical coach. Reply in 2-3 sentences maximum.";

        String finalErrors = errorsDetail.isBlank() ? (fr ? "aucune" : "none") : errorsDetail;

        String prompt = fr
                ? String.format(
                        "Niveau %s \u2014 exercices de %s. Score : %d/100 (%d/%d bonnes r\u00e9ponses). Erreurs : %s. Donne un feedback motivant.",
                        level, type, score, correct, total, finalErrors)
                : String.format(
                        "Level %s \u2014 %s exercises. Score: %d/100 (%d/%d correct). Errors: %s. Give motivating feedback.",
                        level, type, score, correct, total, finalErrors);

        return callOllama(system, prompt, 120, 0.5);
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

        return callOllama(system, prompt, 400, 0.75);
    }

    public String adaptNextStep(String lang, String level, String targetSound,
            int lastScore, String lastPhrase, List<String> weakSounds) {
        boolean fr = "fr".equals(lang);
        String weakHint = "";
        if (weakSounds != null && !weakSounds.isEmpty()) {
            weakHint = (fr ? " Sons faibles : " : " Weak sounds: ") + String.join(", ", weakSounds) + ".";
        }

        String system = fr
                ? "Tu es un g\u00e9n\u00e9rateur de phrases de pratique orale. R\u00e9ponds UNIQUEMENT en JSON valide, rien d'autre."
                : "You are a spoken practice phrase generator. Reply ONLY with valid JSON, nothing else.";

        // Using beautiful Java Text Blocks
        String prompt = fr
                ? String.format(
                        """
                        G\u00e9n\u00e8re une phrase fran\u00e7aise niveau %s ciblant le son [%s].%s
                        Score pr\u00e9c\u00e9dent : %d/100. Phrase pr\u00e9c\u00e9dente : "%s".
                        Adapte la difficult\u00e9 selon le score (score < 55 \u2192 plus simple, score > 75 \u2192 plus difficile).
                        R\u00e9ponds avec CE JSON exact :
                        {"phrase":"...","target_sound":"%s","tip":"...","difficulty":"..."}""",
                        level, targetSound, weakHint, lastScore, lastPhrase, targetSound)
                : String.format(
                        """
                        Generate an English sentence at level %s targeting the sound [%s].%s
                        Previous score: %d/100. Previous phrase: "%s".
                        Adapt difficulty based on score (score < 55 \u2192 easier, score > 75 \u2192 harder).
                        Reply with EXACTLY this JSON:
                        {"phrase":"...","target_sound":"%s","tip":"...","difficulty":"..."}""",
                        level, targetSound, weakHint, lastScore, lastPhrase, targetSound);

        return callOllama(system, prompt, 120, 0.7);
    }

    public String generatePlannerSummary(String lang, String level,
            List<Map<String, Object>> stepResults) {
        boolean fr = "fr".equals(lang);

        StringBuilder sb = new StringBuilder();
        for (Map<String, Object> r : stepResults) {
            sb.append(String.format("  son=%s score=%s%n",
                    r.getOrDefault("targetSound", r.getOrDefault("target_sound", "?")),
                    r.getOrDefault("score", "?")));
        }

        String system = fr
                ? "Tu es un coach p\u00e9dagogique. R\u00e9ponds UNIQUEMENT en JSON valide, rien d'autre."
                : "You are a pedagogical coach. Reply ONLY with valid JSON, nothing else.";

        // Using Java Text Blocks
        String prompt = fr
                ? String.format(
                        """
                        Voici les r\u00e9sultats d'une session de prononciation niveau %s :
                        %s
                        G\u00e9n\u00e8re un bilan JSON avec CE format exact :
                        {"mastered":["son1"],"to_work":["son2"],"encouragement":"...","next_focus":"..."}""",
                        level, sb)
                : String.format(
                        """
                        Here are the results of a level %s pronunciation session:
                        %s
                        Generate a summary JSON with EXACTLY this format:
                        {"mastered":["sound1"],"to_work":["sound2"],"encouragement":"...","next_focus":"..."}""",
                        level, sb);

        return callOllama(system, prompt, 200, 0.4);
    }

    public String generateReportsAnalysis(String lang, String level, List<Integer> scores) {
        boolean fr = "fr".equals(lang);
        int avg = scores.isEmpty() ? 0 : (int) Math.round(scores.stream().mapToInt(i -> i).average().orElse(0));
        int best = scores.isEmpty() ? 0 : scores.stream().mapToInt(i -> i).max().orElse(0);

        String system = fr
                ? "Tu es un coach de prononciation. R\u00e9ponds UNIQUEMENT en JSON valide, rien d'autre."
                : "You are a pronunciation coach. Reply ONLY with valid JSON, nothing else.";
        
        // Using Java Text Blocks
        String prompt = fr
                ? String.format(
                        """
                        Voici les scores d'un apprenant niveau %s : %s.
                        Score moyen=%d/100, meilleur=%d/100.
                        G\u00e9n\u00e8re exactement ce JSON :
                        {"avg_score":%d,"best_score":%d,"trend":"...","tips":["conseil1","conseil2","conseil3"]}""",
                        level, scores, avg, best, avg, best)
                : String.format(
                        """
                        Here are the scores of a level %s learner: %s.
                        Average=%d/100, best=%d/100.
                        Generate exactly this JSON:
                        {"avg_score":%d,"best_score":%d,"trend":"...","tips":["tip1","tip2","tip3"]}""",
                        level, scores, avg, best, avg, best);

        return callOllama(system, prompt, 300, 0.5);
    }

    public boolean isHealthy() {
        if (azureEnabled) {
            try {
                String url = azureEndpoint.replaceAll("/$", "")
                        + PATH_AZURE_DEPLOYMENTS + azureDeployment
                        + PATH_AZURE_COMPLETIONS + AZURE_API_VERSION;
                HttpHeaders h = new HttpHeaders();
                h.setContentType(MediaType.APPLICATION_JSON);
                h.set(HEADER_AZURE_KEY, azureKey);
                Map<String, Object> body = Map.of(
                        KEY_MESSAGES, List.of(Map.of("role", "user", KEY_CONTENT, "hi")),
                        KEY_MAX_TOKENS, 1);
                restTemplate.exchange(url, HttpMethod.POST, new HttpEntity<>(body, h), String.class);
                return true;
            } catch (Exception e) {
                return false;
            }
        }
        try {
            return restTemplate
                    .getForEntity(ollamaBaseUrl + "/api/tags", String.class)
                    .getStatusCode().is2xxSuccessful();
        } catch (Exception e) {
            return false;
        }
    }

    private String callAzureOpenAI(List<Map<String, Object>> messages, int maxTokens, double temperature) {
        try {
            String url = azureEndpoint.replaceAll("/$", "")
                    + PATH_AZURE_DEPLOYMENTS + azureDeployment
                    + PATH_AZURE_COMPLETIONS + AZURE_API_VERSION;
            Map<String, Object> body = new LinkedHashMap<>();
            body.put(KEY_MESSAGES, messages);
            body.put(KEY_MAX_TOKENS, maxTokens);
            body.put(KEY_TEMPERATURE, temperature);
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set(HEADER_AZURE_KEY, azureKey);
            ResponseEntity<byte[]> response = restTemplate.exchange(
                    url, HttpMethod.POST, new HttpEntity<>(body, headers), byte[].class);
            JsonNode json = objectMapper.readTree(response.getBody());
            return json.path("choices").path(0).path(KEY_MESSAGE).path(KEY_CONTENT).asText("").trim();
        } catch (Exception e) {
            return "Response unavailable: " + e.getMessage();
        }
    }

    private String streamAzureChatbot(List<Map<String, Object>> messages, Consumer<String> onToken) {
        String url = azureEndpoint.replaceAll("/$", "")
                + PATH_AZURE_DEPLOYMENTS + azureDeployment
                + PATH_AZURE_COMPLETIONS + AZURE_API_VERSION;
        Map<String, Object> body = new LinkedHashMap<>();
        body.put(KEY_MESSAGES, messages);
        body.put(KEY_MAX_TOKENS, 110);
        body.put(KEY_TEMPERATURE, 0.72);
        body.put("stream", true);
        StringBuilder full = new StringBuilder();
        try {
            restTemplate.execute(url, HttpMethod.POST,
                    request -> {
                        request.getHeaders().setContentType(MediaType.APPLICATION_JSON);
                        request.getHeaders().set(HEADER_AZURE_KEY, azureKey);
                        objectMapper.writeValue(request.getBody(), body);
                    },
                    response -> {
                        try (BufferedReader reader = new BufferedReader(
                                new InputStreamReader(response.getBody(), StandardCharsets.UTF_8))) {
                            String line;
                            while ((line = reader.readLine()) != null) {
                                if (line.isBlank() || line.equals("data: [DONE]")) continue;
                                if (line.startsWith("data: ")) line = line.substring(6);
                                try {
                                    JsonNode node = objectMapper.readTree(line);
                                    String token = node.path("choices").path(0).path("delta").path(KEY_CONTENT).asText("");
                                    if (!token.isEmpty()) {
                                        full.append(token);
                                        if (onToken != null) onToken.accept(token);
                                    }
                                } catch (Exception ignored) { log.debug("Skipping malformed SSE line"); }
                            }
                        }
                        return null;
                    });
        } catch (Exception e) {
            if (full.isEmpty()) return "Response unavailable";
        }
        return full.toString().trim();
    }

    private String stripEmojis(String s) {
        if (s == null) return "";
        // Remove surrogate pairs (supplementary plane emojis like U+1F3AF)
        String cleaned = s.replaceAll("[\\uD800-\\uDFFF]", "");
        // Remove other symbol chars in BMP (most remaining emojis)
        cleaned = cleaned.replaceAll("\\p{So}", "");
        return cleaned.strip();
    }
}