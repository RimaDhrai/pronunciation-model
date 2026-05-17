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
            system = "Tu gÃ©nÃ¨res UNE phrase franÃ§aise parlÃ©e, niveau " + level + ". " +
                    "INTERDIT : explications, guillemets, tirets, numÃ©ros, mÃ©ta-commentaires. " +
                    "RÃ©ponds UNIQUEMENT avec la phrase, rien d'autre.";
            prompt = "GÃ©nÃ¨re une phrase franÃ§aise de " + wc
                    + " sur un sujet quotidien (voyage, nourriture, famille, travail, mÃ©tÃ©o, sport).";
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
                .replaceAll("^[\"'Â«Â»\\-*#â€¢]+", "")
                .replaceAll("[\"'Â«Â»]+$", "")
                .replaceAll("[.!?]+$", "")
                .trim();
        // Use taxonomy fallback when Ollama hallucinates
        if (taxonomy.isHallucination(cleaned, lang)) {
            return taxonomy.getFallback(lang, level, "general");
        }
        return cleaned;
    }

    public String feedback(String expectedPhrase, String transcription, int score, String lang) {
        String system = "fr".equals(lang)
                ? "Coach prononciation. 1-2 phrases en franÃ§ais, bienveillant."
                : "Pronunciation coach. 1-2 sentences in English, encouraging.";
        String prompt = "fr".equals(lang)
                ? String.format("Â«%sÂ»â†’Â«%sÂ» score=%d", expectedPhrase, transcription, score)
                : String.format("\"%s\"â†’\"%s\" score=%d", expectedPhrase, transcription, score);

        return callOllama(system, prompt, 80, 0.4);
    }

    public String generateFeedback(
            String expectedPhrase,
            String rawTranscription,
            String cleanTranscription,
            List<String> fillers,
            Map<String, Object> scoreResult,
            String lang,
            String level) {
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
                    default -> {}
                }
            }
        }
        Boolean hallucination = (Boolean) scoreResult.get("suspected_hallucination");
        int nExpected = scoreResult.containsKey("n_expected") ? ((Number) scoreResult.get("n_expected")).intValue() : 0;
        int nMatch = scoreResult.containsKey("n_match") ? ((Number) scoreResult.get("n_match")).intValue() : 0;

        if (errors.length() == 0)
            errors.append("  - Aucune erreur majeure\n");

        // Si hallucination suspectÃ©e, ajouter un contexte explicite pour que le coach
        // soit honnÃªte
        if (Boolean.TRUE.equals(hallucination)) {
            String halNote = "fr".equals(lang)
                    ? String.format("  - \u26A0\uFE0F L'apprenant n'a probablement prononcé que %d/%d mots de la phrase%n",
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
                        level, expectedPhrase, cleanTranscription, scoreResult.get("score"), errors)
                : String.format("Level %s%nExpected: \"%s\"%nTranscribed: \"%s\"%nScore: %s/100%nDetails:%n%s",
                        level, expectedPhrase, cleanTranscription, scoreResult.get("score"), errors);

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

        // numCtx=2048 pour le chatbot (historique 6 messages + system prompt)
        String raw = callOllamaMessages(chatbotModel, messages, 110, 0.65, 1024);
        // Supprime les balises <think>...</think> si le modÃ¨le les gÃ©nÃ¨re
        String cleaned = raw.replaceAll("(?i)<think>[\\s\\S]*?</think>", "").trim();
        return cleaned.isBlank() ? raw.trim() : cleaned;
    }

    /**
     * Builds the enriched user-content string (adds weak-word hints / score badge).
     */
    public String buildChatbotUserContent(
            String userText, List<String> weakWords, Double pronScore, String lang) {
        String content = (userText == null || userText.isBlank())
                ? "(silence â€” encourage user to speak)"
                : userText;
        if (weakWords != null && !weakWords.isEmpty()) {
            String hint = weakWords.stream()
                    .map(w -> "\"" + w + "\"")
                    .collect(java.util.stream.Collectors.joining(", "));
            content += switch (lang) {
                case "en" -> "\n[Uncertain pronunciation: " + hint + "]";
                case "es" -> "\n[PronunciaciÃ³n incierta: " + hint + "]";
                case "de" -> "\n[Unsichere Aussprache: " + hint + "]";
                default -> "\n[Prononciation incertaine: " + hint + "]";
            };
        } else if (pronScore != null && pronScore >= 0.80) {
            int pct = (int) (pronScore * 100);
            content += switch (lang) {
                case "en" -> "\n[Pronunciation score: " + pct + "% â€” very good!]";
                case "es" -> "\n[PuntuaciÃ³n: " + pct + "% â€” Â¡muy bien!]";
                case "de" -> "\n[Aussprache-Score: " + pct + "% â€” sehr gut!]";
                default -> "\n[Score prononciation: " + pct + "% â€” trÃ¨s bon !]";
            };
        }
        return content;
    }

    /** Public access to system prompt for streaming path. */
    public String getChatbotSystemPrompt(String lang, String level, String scenario) {
        return (scenario != null && !scenario.isBlank())
                ? buildRoleplaySystemPrompt(lang, level, scenario)
                : buildChatbotSystemPrompt(lang, level);
    }

    /**
     * Builds the messages list for the chatbot: [system, ...last-6-history, user].
     */
    public List<Map<String, Object>> buildChatbotMessagesList(
            List<Map<String, String>> history, String userContent, String systemPrompt) {
        List<Map<String, Object>> messages = new ArrayList<>();
        messages.add(Map.of("role", "system", "content", systemPrompt));
        if (history != null) {
            int start = Math.max(0, history.size() - 4);
            for (Map<String, String> h : history.subList(start, history.size())) {
                messages.add(Map.of("role", h.get("role"), "content", h.get("content")));
            }
        }
        messages.add(Map.of("role", "user", "content", userContent));
        return messages;
    }

    /**
     * Same as generateChatbotResponse but streams tokens via onToken callback.
     * Returns full response.
     */
    public String streamChatbotResponse(
            List<Map<String, Object>> messages, Consumer<String> onToken) {
        if (azureEnabled) {
            String raw = streamAzureChatbot(messages, onToken);
            String cleaned = raw.replaceAll("(?i)<think>[\\s\\S]*?</think>", "").trim();
            return cleaned.isBlank() ? raw : cleaned;
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", chatbotModel);
        body.put("stream", true);
        body.put("options", Map.of("temperature", 0.72, "num_predict", 110, "num_ctx", 1024));
        body.put("messages", messages);

        StringBuilder full = new StringBuilder();
        try {
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
                                if (line.isBlank())
                                    continue;
                                try {
                                    JsonNode node = objectMapper.readTree(line);
                                    String token = node.path("message").path("content").asText("");
                                    if (!token.isEmpty()) {
                                        full.append(token);
                                        if (onToken != null)
                                            onToken.accept(token);
                                    }
                                } catch (Exception ignored) { log.debug("Skipping malformed SSE line"); }
                            }
                        }
                        return null;
                    });
        } catch (Exception e) {
            if (full.isEmpty())
                return "\u26A0\uFE0F Réponse indisponible";
        }
        String raw = full.toString().trim();
        String cleaned = raw.replaceAll("(?i)<think>[\\s\\S]*?</think>", "").trim();
        return cleaned.isBlank() ? raw : cleaned;
    }

    private String buildRoleplaySystemPrompt(String lang, String level, String scenario) {
        boolean fr = !"en".equals(lang);
        String levelHint = fr ? switch (level) {
            case "A1" -> "utilise des phrases trÃ¨s simples (max 8 mots)";
            case "A2" -> "utilise des phrases simples et courtes";
            case "B1" -> "utilise un langage courant, clair";
            case "B2" -> "utilise un langage naturel et variÃ©";
            default -> "utilise un langage riche et naturel";
        } : switch (level) {
            case "A1" -> "use very short simple sentences (max 8 words)";
            case "A2" -> "use simple and short sentences";
            case "B1" -> "use everyday clear language";
            case "B2" -> "use natural and varied language";
            default -> "use rich and natural language";
        };

        String roleContext = switch (scenario) {
            case "customs" -> fr
                    ? ("Tu es douanier a l'aeroport CDG. %s. Max 2 phrases. Verifie passeport, duree du sejour, bagages. Si [Prononciation incertaine: X] : corrige le mot X dans le role et ajoute [REPETE: \"phrase courte avec X\"]. Ne repete pas la meme phrase que l'apprenant. Avance le scenario.")
                            .formatted(levelHint)
                    : ("You are a border control officer at Heathrow. %s. Max 2 sentences. Check passport, duration of stay, luggage. If [Uncertain pronunciation: X] : correct X in character then add [REPEAT: \"short phrase with X\"]. Never repeat the learner's sentence. Advance the scenario.")
                            .formatted(levelHint);
            case "interview" -> fr
                    ? ("Tu es manager RH en entretien d'embauche. %s. Max 2 phrases. Questions sur parcours, motivation, competences. Si [Prononciation incertaine: X] : corrige X discretement puis ajoute [REPETE: \"phrase courte avec X\"]. Jamais la meme phrase que l'apprenant. Avance l'entretien.")
                            .formatted(levelHint)
                    : ("You are a hiring manager conducting a job interview. %s. Max 2 sentences. Ask about background, motivation, skills. If [Uncertain pronunciation: X] : correct X subtly then add [REPEAT: \"short phrase with X\"]. Never repeat the learner's sentence. Advance the interview.")
                            .formatted(levelHint);
            case "restaurant" -> fr
                    ? ("Tu es serveur dans un restaurant parisien elegant. %s. Max 2 phrases. Guide : accueil -> carte -> commande -> addition. Si [Prononciation incertaine: X] : corrige X naturellement puis ajoute [REPETE: \"phrase courte avec X\"]. Ne repete pas la phrase de l'apprenant.")
                            .formatted(levelHint)
                    : ("You are a waiter at a London restaurant. %s. Max 2 sentences. Guide: welcome -> menu -> order -> bill. If [Uncertain pronunciation: X] : correct X naturally then add [REPEAT: \"short phrase with X\"]. Never repeat the learner's sentence.")
                            .formatted(levelHint);
            default -> buildChatbotSystemPrompt(lang, level);
        };
        return roleContext;
    }

    private String buildChatbotSystemPrompt(String lang, String level) {
        return switch (lang) {
            case "en" ->
                """
                        You are a warm English pronunciation coach. Learner level: %s.
                        STYLE: have a real conversation - ask questions, react naturally, change topics.
                        ABSOLUTE RULE: Never repeat the learner's message word for word.
                        CORRECTION: If [Uncertain pronunciation: X] appears, correct X then add [REPEAT: "3-5 NEW words containing X"]. The [REPEAT] phrase must be DIFFERENT from all previous ones. Never write "Repeat after me" in plain text.
                        NO ERROR: pure conversation, no [REPEAT] tag.
                        NEVER two [REPEAT] in a row. Max 2 sentences. No <think>. Friendly tone.
                        """
                        .formatted(level);
            case "es" ->
                """
                        Eres un coach certificado de pronunciaciÃ³n. Nivel MCER: %s.
                        ESTILO: profesional, alentador, usa IPA cuando ayude (/r/ vibrante, /x/ jota, /Î²/ entre vocales).
                        FORMATO (2-3 frases): 1) Reacciona al tema. 2) Si [PronunciaciÃ³n incierta: X]: IPA + posiciÃ³n articulatoria. Si scoreâ‰¥80: elogio especÃ­fico. 3) Una pregunta de seguimiento.
                        REGLAS: Nunca escribas <think>. Adapta al nivel %s.
                        """
                        .formatted(level, level);
            case "de" ->
                """
                        Du bist ein zertifizierter Aussprachecoach. Niveau: %s.
                        STIL: professionell, ermutigend, IPA wenn hilfreich (/Ê/ ZÃ¤pfchen-R, /Ã§/ ich-Laut, /Ê/ kurzes Ã¼).
                        FORMAT (2-3 SÃ¤tze): 1) Auf Thema eingehen. 2) Bei [Unsichere Aussprache: X]: IPA + Artikulationshinweis. Bei Scoreâ‰¥80: spezifisches Lob. 3) Eine Folgefrage.
                        REGELN: Kein <think>. Niveau %s anpassen.
                        """
                        .formatted(level, level);
            default ->
                """
                        Tu es un coach de prononciation francaise sympathique. Niveau apprenant : %s.
                        STYLE : mene une vraie conversation - pose des questions, reagis, change de sujet naturellement.
                        REGLE ABSOLUE : Ne repete JAMAIS le message de l'apprenant mot pour mot.
                        CORRECTION : Si [Prononciation incertaine: X] apparait, reponds en corrigeant X puis ajoute [REPETE: "3-5 mots NOUVEAUX contenant X"]. La phrase [REPETE] doit etre differente de toutes les phrases precedentes. Ne dis pas "Repete apres moi" en texte brut.
                        SANS ERREUR : conversation pure, sans balise [REPETE].
                        JAMAIS deux [REPETE] de suite. Max 2 phrases. Pas de <think>. Ton chaleureux.
                        """
                        .formatted(level);
        };
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // LEVEL TEST â€” phrase / tip / feedback / synthesis
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    public String generateLevelTestPhrase(String lang, String soundContext, String level) {
        String[] words = soundContext.split(",");
        String w0 = words[0].trim();
        String w1 = words.length > 1 ? words[1].trim() : w0;
        String w2 = words.length > 2 ? words[2].trim() : w0;

        String cefrSpec = "fr".equals(lang) ? switch (level) {
            case "A1" -> "niveau CECR A1 : phrase de 4-6 mots, present simple, vocabulaire de base (maison, famille, couleurs). Exemple de structure : \"Le [nom] est [adjectif].\"";
            case "A2" -> "niveau CECR A2 : phrase de 6-9 mots, verbes courants, lieux et activites du quotidien. Exemple : \"Je vais [lieu] avec [personne] chaque [moment]\"";
            case "B1" -> "niveau CECR B1 : phrase de 9-13 mots, proposition subordonnee simple, vocabulaire thematique (voyage, travail, loisirs)";
            case "B2" -> "niveau CECR B2 : phrase de 12-16 mots, structures complexes, vocabulaire varie et precis, connecteurs logiques";
            case "C1" -> "niveau CECR C1 : phrase de 15-19 mots, subjonctif ou conditionnel, vocabulaire soutenu, idiotismes naturels";
            case "C2" -> "niveau CECR C2 : phrase de 18-22 mots, registre soutenu, structures syntaxiques elaborees, vocabulaire riche";
            default -> "niveau CECR B1 : phrase naturelle de 9-13 mots";
        } : switch (level) {
            case "A1" -> "CEFR A1: 4-6 words, present simple, basic vocabulary (home, family, colors). Example: \"The [noun] is [adjective].\"";
            case "A2" -> "CEFR A2: 6-9 words, common verbs, daily places and activities";
            case "B1" -> "CEFR B1: 9-13 words, simple subordinate clause, thematic vocabulary (travel, work, leisure)";
            case "B2" -> "CEFR B2: 12-16 words, complex structures, precise varied vocabulary, logical connectors";
            case "C1" -> "CEFR C1: 15-19 words, sophisticated grammar, natural idioms, formal vocabulary";
            case "C2" -> "CEFR C2: 18-22 words, elevated register, elaborate syntax, rich vocabulary";
            default -> "CEFR B1: natural sentence of 9-13 words";
        };

        String system = "fr".equals(lang)
                ? "Tu generes UNE phrase francaise orale, " + cefrSpec + ". La phrase doit contenir au moins 2 des mots cibles. INTERDIT : introduction, guillemets, explication. Reponds UNIQUEMENT avec la phrase."
                : "Generate ONE spoken English sentence, " + cefrSpec + ". The sentence must contain at least 2 target words. FORBIDDEN: introduction, quotes, explanation. Reply with the sentence ONLY.";
        String prompt = "fr".equals(lang)
                ? "Mots cibles : " + w0 + ", " + w1 + ", " + w2 + ". Phrase :"
                : "Target words: " + w0 + ", " + w1 + ", " + w2 + ". Sentence:";

        String cleaned = cleanLevelTestPhrase(callOllama(system, prompt, 45, 0.7));
        if (cleaned.length() < 8 || taxonomy.isHallucination(cleaned, lang) || cleaned.contains("indisponible")) {
            return taxonomy.getFallback(lang, level, "general");
        }
        return cleaned;
    }
    public String generateLevelTestTip(String lang, String soundLabel) {
        String system = "fr".equals(lang)
                ? "Coach prononciation. RÃ©ponds avec UNE phrase de conseil pratique, max 15 mots, sans tiret ni numÃ©ro."
                : "Pronunciation coach. Reply with ONE practical tip, max 15 words, no dash or number.";
        String prompt = "fr".equals(lang)
                ? "Conseil articulatoire pour " + soundLabel + ":"
                : "Articulation tip for " + soundLabel + ":";
        String raw = callOllama(system, prompt, 35, 0.35);
        return raw.length() > 10 ? raw : "";
    }

    public String generateLevelTestFeedback(String lang, String soundLabel,
            String contextWords, String phrase, int score, String userName) {
        String cacheKey = lang + "_" + soundLabel + "_" + (score / 10);
        String cached = feedbackCache.get(cacheKey);
        if (cached != null)
            return cached;

        String learner = (userName != null && !userName.isBlank()) ? userName : "apprenant";
        String perf = "fr".equals(lang)
                ? (score >= 75 ? "trÃ¨s bonne (score " + score + "/100)"
                        : score >= 55 ? "correcte (score " + score + "/100)"
                                : "à améliorer (score " + score + "/100)")
                : (score >= 75 ? "very good (score " + score + "/100)"
                        : score >= 55 ? "decent (score " + score + "/100)"
                                : "needs work (score " + score + "/100)");

        String prompt = "fr".equals(lang)
                ? "Tu es un coach de prononciation bienveillant. L'apprenant s'appelle " + learner
                        + " et vient de prononcer : Â« " + phrase + "Â».\n"
                        + "Son ciblÃ© : " + soundLabel + " (exemples : " + contextWords + ").\nPerformance : " + perf
                        + ".\n"
                        + "Donne un retour personnalisÃ© en 2-3 phrases courtes : mentionne le son Â« " + soundLabel
                        + "Â», donne un conseil pratique, encourage. Pas de tirets ni numÃ©ros."
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
        if (feedbackCache.size() < 200)
            feedbackCache.put(cacheKey, result);
        return result;
    }

    public String generateLevelTestSynthesis(String lang,
            List<Map<String, Object>> history,
            String finalLevel) {
        StringBuilder lines = new StringBuilder();
        int total = 0, count = 0;
        for (Map<String, Object> h : history) {
            int sc = h.get("score") instanceof Number n ? n.intValue() : 0;
            total += sc;
            count++;
            lines.append("- ").append(h.getOrDefault("sound_label", "?"))
                    .append(": ").append(sc).append("/100\n");
        }
        int avg = count > 0 ? total / count : 0;

        String prompt = "fr".equals(lang)
                ? "Tu es un coach de prononciation. Niveau final : " + finalLevel + ".\nRÃ©sultats :\n" + lines
                        + "Ã‰cris un bilan encourageant en 3-4 phrases. Cite les points forts et ce qui peut Ãªtre amÃ©liorÃ©. Pas de tirets ni numÃ©ros."
                : "You are a pronunciation coach. Final level: " + finalLevel + ".\nResults:\n" + lines
                        + "Write an encouraging summary in 3-4 sentences. Mention strengths and areas to improve. No dashes or numbers.";

        String raw = callOllama("", prompt, 150, 0.4);
        if (raw.length() > 20)
            return raw;

        if ("fr".equals(lang)) {
            if (avg >= 75)
                return "TrÃ¨s bon niveau (" + finalLevel + ") ! Tu es sur la bonne voie.";
            if (avg >= 55)
                return "Bon niveau gÃ©nÃ©ral (" + finalLevel + "). Quelques sons mÃ©ritent plus de pratique.";
            return "Des bases solides à renforcer. Pratique régulièrement les sons ciblés pour progresser.";
        } else {
            if (avg >= 75)
                return "Very good pronunciation (" + finalLevel + ")! Keep up the great work.";
            if (avg >= 55)
                return "Good overall level (" + finalLevel + "). A few sounds need more practice.";
            return "Solid foundations at " + finalLevel + ". Keep practicing the target sounds regularly.";
        }
    }

    private String cleanLevelTestPhrase(String raw) {
        if (raw == null || raw.isBlank())
            return "";
        // Split into lines and clean each one
        for (String line : raw.strip().split("\n")) {
            line = line.strip();
            if (line.isBlank())
                continue;
            // Remove common list prefixes (e.g., "-", "*", "1.")
            line = line.replaceAll("^[\\-\\*\\d\\.\\)]+\\s*", "");
            // Strip surrounding quotation marks or french guillemets
            line = line.replaceAll("(^[\\"\\'«»“”„]+)|([\\"\\'«»“”„]+$)", "");
            // If a short prefix before a colon exists, drop it (e.g., "Phrase: ...")
            if (line.contains(":") && line.indexOf(':') < 20) {
                line = line.substring(line.indexOf(':') + 1).strip();
            }
            // Discard obvious code or HTML fragments
            String lower = line.toLowerCase();
            if (lower.matches(
                    ".*\\b(reactdom\\.render|function\\s+\\w+|class\\s+\\w+|import\\s+|export\\s+|<[^>]+>|\\{.*\\}|;).*")) {
                continue;
            }
            if (line.length() > 10)
                return line;
        }
        // Fallback: return the whole stripped raw text
        return raw.strip();
    }

    private String buildLevelTestFeedbackFallback(String lang, String soundLabel,
            String contextWords, int score) {
        String w0 = contextWords.split(",")[0].trim();
        if ("fr".equals(lang)) {
            if (score >= 75)
                return "Excellent ! Tu prononces trÃ¨s bien le son " + soundLabel + ". Continue ! ðŸŒŸ";
            if (score >= 55)
                return "Bien jouÃ© ! Le son " + soundLabel + " est presque parfait. RÃ©pÃ¨te : " + w0 + " ðŸ‘";
            return "Le son " + soundLabel + " est difficile. EntraÃ®ne-toi avec : " + w0 + ". Ã‡a viendra ! ðŸ’ª";
        } else {
            if (score >= 75)
                return "Excellent! You nailed the " + soundLabel + " sound. Keep it up! ðŸŒŸ";
            if (score >= 55)
                return "Well done! The " + soundLabel + " is almost perfect. Practice: " + w0 + " ðŸ‘";
            return "The " + soundLabel + " is challenging. Practice: " + w0 + ". You'll get there! ðŸ’ª";
        }
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // PUBLIC RAW CALL â€” used by ExerciseAiController for revision/phonetic
    // phrases
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    /** Calls Ollama and strips hallucinations; throws on HTTP error. */
    public String callRaw(String system, String userPrompt, int maxTokens, double temperature, String expectedLang) {
        String raw = callOllama(system, userPrompt, maxTokens, temperature);
        String cleaned = raw.split("\n")[0].trim()
                .replaceAll("^[\"'Â«Â»\\-*#â€¢\\d.)+\\s]+", "")
                .replaceAll("[\"'Â«Â»]+$", "")
                .trim();
        return taxonomy.isHallucination(cleaned, expectedLang) ? null : cleaned;
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // APPEL OLLAMA /api/chat (single implementation â€” delegates from 2-message
    // helper)
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    private String callOllama(String system, String userPrompt, int maxTokens, double temperature) {
        List<Map<String, Object>> messages = system.isBlank()
                ? List.of(Map.of("role", "user", "content", userPrompt))
                : List.of(
                        Map.of("role", "system", "content", system),
                        Map.of("role", "user", "content", userPrompt));
        return callOllamaMessages(ollamaModel, messages, maxTokens, temperature);
    }

    /**
     * All Ollama HTTP calls go through here. Used by chatbot (with full history)
     * and all other callers.
     */
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
            body.put("model", model);
            body.put("stream", false);
            body.put("options", Map.of("temperature", temperature, "num_predict", maxTokens, "num_ctx", numCtx));
            body.put("messages", messages);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            ResponseEntity<byte[]> response = restTemplate.exchange(
                    ollamaBaseUrl + "/api/chat",
                    HttpMethod.POST,
                    new HttpEntity<>(body, headers),
                    byte[].class);
            JsonNode json = objectMapper.readTree(response.getBody());
            return json.path("message").path("content").asText("").trim();
        } catch (Exception e) {
            return "\u26A0\uFE0F Réponse indisponible : " + e.getMessage();
        }
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // EXERCICES IA
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    public String generateExercises(String lang, String level, String type, int count) {
        boolean fr = "fr".equals(lang);
        String typeLabel = fr ? switch (type) {
            case "grammar" -> "grammaire";
            case "vocabulary" -> "vocabulaire";
            case "pronunciation" -> "prononciation";
            case "listening" -> "comprÃ©hension orale";
            default -> type;
        } : type;

        String system = fr
                ? "Tu es un gÃ©nÃ©rateur d'exercices pÃ©dagogiques. RÃ©ponds UNIQUEMENT avec un tableau JSON valide, rien d'autre."
                : "You are an educational exercise generator. Reply ONLY with a valid JSON array, nothing else.";

        String prompt = fr
                ? String.format(
                        "GÃ©nÃ¨re %d exercices de %s en franÃ§ais pour le niveau CECR %s.\n" +
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
                ? "Tu es un coach pÃ©dagogique bienveillant. RÃ©ponds en 2-3 phrases maximum."
                : "You are an encouraging pedagogical coach. Reply in 2-3 sentences maximum.";

        String prompt = fr
                ? String.format(
                        "Niveau %s â€” exercices de %s. Score : %d/100 (%d/%d bonnes rÃ©ponses). Erreurs : %s. Donne un feedback motivant.",
                        level, type, score, correct, total, errorsDetail.isBlank() ? "aucune" : errorsDetail)
                : String.format(
                        "Level %s â€” %s exercises. Score: %d/100 (%d/%d correct). Errors: %s. Give motivating feedback.",
                        level, type, score, correct, total, errorsDetail.isBlank() ? "none" : errorsDetail);

        return callOllama(system, prompt, 120, 0.5);
    }

    public String generateExercisePhrases(String lang, String level, int count) {
        boolean fr = "fr".equals(lang);
        String system = fr
                ? "Tu gÃ©nÃ¨res des phrases de pratique orale. RÃ©ponds UNIQUEMENT avec un tableau JSON valide, rien d'autre."
                : "You generate spoken practice phrases. Reply ONLY with a valid JSON array, nothing else.";

        String prompt = fr
                ? String.format(
                        "GÃ©nÃ¨re %d phrases franÃ§aises de pratique orale pour le niveau CECR %s.\n" +
                                "Format JSON : [\"phrase1\",\"phrase2\",...]",
                        count, level)
                : String.format(
                        "Generate %d English spoken practice phrases for CEFR level %s.\n" +
                                "JSON format: [\"phrase1\",\"phrase2\",...]",
                        count, level);

        return callOllama(system, prompt, 400, 0.75);
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // PLANNER AGENT â€” Ã©tape adaptÃ©e
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    public String adaptNextStep(String lang, String level, String targetSound,
            int lastScore, String lastPhrase, List<String> weakSounds) {
        boolean fr = "fr".equals(lang);
        String weakHint = (weakSounds != null && !weakSounds.isEmpty())
                ? (fr ? " Sons faibles : " : " Weak sounds: ") + String.join(", ", weakSounds) + "."
                : "";

        String system = fr
                ? "Tu es un gÃ©nÃ©rateur de phrases de pratique orale. RÃ©ponds UNIQUEMENT en JSON valide, rien d'autre."
                : "You are a spoken practice phrase generator. Reply ONLY with valid JSON, nothing else.";

        String prompt = fr
                ? String.format(
                        "GÃ©nÃ¨re une phrase franÃ§aise niveau %s ciblant le son [%s].%s\n" +
                                "Score prÃ©cÃ©dent : %d/100. Phrase prÃ©cÃ©dente : \"%s\".\n" +
                                "Adapte la difficultÃ© selon le score (score < 55 â†’ plus simple, score > 75 â†’ plus difficile).\n"
                                +
                                "RÃ©ponds avec CE JSON exact :\n" +
                                "{\"phrase\":\"...\",\"target_sound\":\"%s\",\"tip\":\"...\",\"difficulty\":\"...\"}",
                        level, targetSound, weakHint, lastScore, lastPhrase, targetSound)
                : String.format(
                        "Generate an English sentence at level %s targeting the sound [%s].%s\n" +
                                "Previous score: %d/100. Previous phrase: \"%s\".\n" +
                                "Adapt difficulty based on score (score < 55 â†’ easier, score > 75 â†’ harder).\n" +
                                "Reply with EXACTLY this JSON:\n" +
                                "{\"phrase\":\"...\",\"target_sound\":\"%s\",\"tip\":\"...\",\"difficulty\":\"...\"}",
                        level, targetSound, weakHint, lastScore, lastPhrase, targetSound);

        return callOllama(system, prompt, 120, 0.7);
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // PLANNER AGENT â€” bilan de session
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
                ? "Tu es un coach pÃ©dagogique. RÃ©ponds UNIQUEMENT en JSON valide, rien d'autre."
                : "You are a pedagogical coach. Reply ONLY with valid JSON, nothing else.";

        String prompt = fr
                ? String.format(
                        "Voici les rÃ©sultats d'une session de prononciation niveau %s :\n%s\n" +
                                "GÃ©nÃ¨re un bilan JSON avec CE format exact :\n" +
                                "{\"mastered\":[\"son1\"],\"to_work\":[\"son2\"],\"encouragement\":\"...\",\"next_focus\":\"...\"}",
                        level, sb)
                : String.format(
                        "Here are the results of a level %s pronunciation session:\n%s\n" +
                                "Generate a summary JSON with EXACTLY this format:\n" +
                                "{\"mastered\":[\"sound1\"],\"to_work\":[\"sound2\"],\"encouragement\":\"...\",\"next_focus\":\"...\"}",
                        level, sb);

        return callOllama(system, prompt, 200, 0.4);
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // BATTLE â€” phrase courte et prononcable pour les duels
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    public String generateBattlePhrase(String lang, String level) {
        String system = "fr".equals(lang)
                ? "GÃ©nÃ¨re UNE seule phrase franÃ§aise pour un exercice de prononciation compÃ©titif. " +
                        "Niveau " + level + ". Pas de guillemets. Pas d'explication. Uniquement la phrase."
                : "Generate ONE English phrase for a competitive pronunciation drill. " +
                        "Level " + level + ". No quotes. No explanation. Just the phrase.";
        String prompt = "fr".equals(lang)
                ? "Une phrase originale, vivante, de 8-12 mots, niveau " + level + "."
                : "An original, lively phrase, 8-12 words, level " + level + ".";
        String raw = callOllama(system, prompt, 60, 0.7);
        String cleaned = raw == null ? "" : raw.replaceAll("(^[\\"\\'«»\\s]+)|([\\"\\'«»\\s]+$)", "").trim();
        if (taxonomy.isHallucination(cleaned, lang)) {
            return taxonomy.getBattleFallback(lang, level);
        }
        return cleaned;
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // REPORTS â€” analyse IA personnalisÃ©e des sessions
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    public String generateReportsAnalysis(String lang, String level, List<Integer> scores) {
        boolean fr = "fr".equals(lang);
        int avg = scores.isEmpty() ? 0 : (int) Math.round(scores.stream().mapToInt(i -> i).average().orElse(0));
        int best = scores.isEmpty() ? 0 : scores.stream().mapToInt(i -> i).max().orElse(0);

        String system = fr
                ? "Tu es un coach de prononciation. RÃ©ponds UNIQUEMENT en JSON valide, rien d'autre."
                : "You are a pronunciation coach. Reply ONLY with valid JSON, nothing else.";
        String prompt = fr
                ? String.format(
                        "Voici les scores d'un apprenant niveau %s : %s.\n" +
                                "Score moyen=%d/100, meilleur=%d/100.\n" +
                                "GÃ©nÃ¨re exactement ce JSON :\n" +
                                "{\"avg_score\":%d,\"best_score\":%d,\"trend\":\"...\",\"tips\":[\"conseil1\",\"conseil2\",\"conseil3\"]}",
                        level, scores, avg, best, avg, best)
                : String.format(
                        "Here are the scores of a level %s learner: %s.\n" +
                                "Average=%d/100, best=%d/100.\n" +
                                "Generate exactly this JSON:\n" +
                                "{\"avg_score\":%d,\"best_score\":%d,\"trend\":\"...\",\"tips\":[\"tip1\",\"tip2\",\"tip3\"]}",
                        level, scores, avg, best, avg, best);

        return callOllama(system, prompt, 300, 0.5);
    }

    public boolean isHealthy() {
        if (azureEnabled) {
            try {
                String url = azureEndpoint.replaceAll("/$", "")
                        + "/openai/deployments/" + azureDeployment
                        + "/chat/completions?api-version=" + AZURE_API_VERSION;
                HttpHeaders h = new HttpHeaders();
                h.setContentType(MediaType.APPLICATION_JSON);
                h.set("api-key", azureKey);
                Map<String, Object> body = Map.of(
                        "messages", List.of(Map.of("role", "user", "content", "hi")),
                        "max_tokens", 1);
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
                    + "/openai/deployments/" + azureDeployment
                    + "/chat/completions?api-version=" + AZURE_API_VERSION;
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("messages", messages);
            body.put("max_tokens", maxTokens);
            body.put("temperature", temperature);
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("api-key", azureKey);
            ResponseEntity<byte[]> response = restTemplate.exchange(
                    url, HttpMethod.POST, new HttpEntity<>(body, headers), byte[].class);
            JsonNode json = objectMapper.readTree(response.getBody());
            return json.path("choices").path(0).path("message").path("content").asText("").trim();
        } catch (Exception e) {
            return "Response unavailable: " + e.getMessage();
        }
    }

    private String streamAzureChatbot(List<Map<String, Object>> messages, Consumer<String> onToken) {
        String url = azureEndpoint.replaceAll("/$", "")
                + "/openai/deployments/" + azureDeployment
                + "/chat/completions?api-version=" + AZURE_API_VERSION;
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("messages", messages);
        body.put("max_tokens", 110);
        body.put("temperature", 0.72);
        body.put("stream", true);
        StringBuilder full = new StringBuilder();
        try {
            restTemplate.execute(url, HttpMethod.POST,
                    request -> {
                        request.getHeaders().setContentType(MediaType.APPLICATION_JSON);
                        request.getHeaders().set("api-key", azureKey);
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
                                    String token = node.path("choices").path(0).path("delta").path("content").asText("");
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
        s = s.replaceAll("[\\uD800-\\uDFFF]", "");
        // Remove other symbol chars in BMP (most remaining emojis)
        s = s.replaceAll("\\p{So}", "");
        return s.trim();
    }}