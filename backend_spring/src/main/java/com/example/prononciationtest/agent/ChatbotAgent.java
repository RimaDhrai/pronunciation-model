package com.example.prononciationtest.agent;

import com.example.prononciationtest.service.OllamaService;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.bsc.langgraph4j.CompileConfig;
import org.bsc.langgraph4j.RunnableConfig;
import org.bsc.langgraph4j.StateGraph;
import org.bsc.langgraph4j.checkpoint.MemorySaver;
import org.bsc.langgraph4j.state.AgentState;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;

import static org.bsc.langgraph4j.StateGraph.END;
import static org.bsc.langgraph4j.StateGraph.START;

@Component
public class ChatbotAgent {

    private static final String NODE_PREPARE_CONTEXT = "prepare_context";
    private static final String NODE_GENERATE_RESPONSE = "generate_response";
    private static final String KEY_LEVEL = KEY_LEVEL;
    private static final String KEY_SCENARIO = KEY_SCENARIO;
    private static final String KEY_CONTENT = KEY_CONTENT;
    private static final String KEY_ASSISTANT = KEY_ASSISTANT;
    private static final String KEY_USER_INPUT = KEY_USER_INPUT;
    private static final String KEY_WEAK_WORDS = KEY_WEAK_WORDS;
    private static final String KEY_PRON_SCORE = KEY_PRON_SCORE;
    private static final String KEY_IS_GREETING = KEY_IS_GREETING;
    private static final String KEY_LAST_RESPONSE = KEY_LAST_RESPONSE;
    private static final String KEY_HISTORY = KEY_HISTORY;
    private static final String KEY_SKIP_LLM = KEY_SKIP_LLM;

    private static final Logger log = LoggerFactory.getLogger(ChatbotAgent.class);
    private static final int MAX_HISTORY = 20;
    private static final long SESSION_TTL_MS = 3_600_000L;

    // Réponses rapides uniquement pour messages très courts (salutations isolées)
    // Ne jamais court-circuiter des phrases complètes contenant ces mots
    private static final Map<String, String> QUICK_RESPONSES;
    static {
        Map<String, String> map = new LinkedHashMap<>();
        map.put("bonjour|salut|coucou|hello|hi", "Bonjour ! Comment puis-je t'aider aujourd'hui ? 🎙️");
        map.put("au revoir|bye|goodbye|à plus", "À bientôt ! Continue à pratiquer, tu fais de beaux progrès ! 👋✨");
        QUICK_RESPONSES = Collections.unmodifiableMap(map);
    }

    private final OllamaService ollamaService;
    private final ThreadPoolTaskExecutor taskExecutor;
    private org.bsc.langgraph4j.CompiledGraph<AgentState> graph;
    private final MemorySaver checkpointer = new MemorySaver();

    // Cache intelligent
    private final Map<String, String> responseCache = new ConcurrentHashMap<>();
    private final Map<String, CompletableFuture<String>> prefetchCache = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Long> lastUsed = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, List<Map<String, String>>> historyCache = new ConcurrentHashMap<>();

    // Session metadata: lang, level, scenario
    private final ConcurrentHashMap<String, Map<String, String>> sessionMeta = new ConcurrentHashMap<>();

    // Pour streaming SSE
    private final Map<String, Consumer<String>> streamCallbacks = new ConcurrentHashMap<>();

    @Autowired
    public ChatbotAgent(OllamaService ollamaService,
                        @Qualifier("levelTestExecutor") ThreadPoolTaskExecutor taskExecutor) {
        this.ollamaService = ollamaService;
        this.taskExecutor = taskExecutor;
    }

    @PostConstruct
    void buildGraph() {
        try {
            graph = new StateGraph<>(AgentState::new)
                    .addEdge(START, NODE_PREPARE_CONTEXT)
                    .addNode(NODE_PREPARE_CONTEXT, (s, c) -> CompletableFuture.completedFuture(prepareContextNode(s)))
                    .addEdge(NODE_PREPARE_CONTEXT, NODE_GENERATE_RESPONSE)
                    .addNode(NODE_GENERATE_RESPONSE, (s, c) -> CompletableFuture.completedFuture(generateResponseNode(s)))
                    .addEdge(NODE_GENERATE_RESPONSE, END)
                    .compile(CompileConfig.builder().checkpointSaver(checkpointer).build());
            log.info("ChatbotAgent initialisé avec cache intelligent");
        } catch (Exception e) {
            throw new IllegalStateException("Failed to build StateGraph in ChatbotAgent", e);
        }
    }

    @PreDestroy
    void cleanup() {
        prefetchCache.values().forEach(f -> f.cancel(true));
        prefetchCache.clear();
        responseCache.clear();
        streamCallbacks.clear();
        sessionMeta.clear();
    }

    // ═════════════════════════════════════════════════════════════════════════
    // API avec RÉPONSE INSTANTANÉE (cache d'abord, LLM en parallèle)
    // ═════════════════════════════════════════════════════════════════════════

    /**
     * Real Ollama streaming — tokens arrive from the LLM and are forwarded via onToken as they come.
     */
    public CompletableFuture<String> chatStreaming(String sessionId, String userText,
                                                   List<String> weakWords, Double pronScore,
                                                   Consumer<String> onToken) {
        if (!lastUsed.containsKey(sessionId)) {
            CompletableFuture<String> err = new CompletableFuture<>();
            err.completeExceptionally(new IllegalArgumentException("Session expirée"));
            return err;
        }
        touch(sessionId);

        // Quick responses (greetings) still served instantly with word-delay illusion
        String quickResponse = getQuickResponse(userText);
        if (quickResponse != null) {
            if (onToken != null) streamWithDelay(quickResponse, onToken, 20);
            return CompletableFuture.completedFuture(quickResponse);
        }

        // Real streaming via Ollama
        return CompletableFuture.supplyAsync(() -> {
            try {
                Map<String, String> meta = sessionMeta.getOrDefault(sessionId, Map.of());
                String lang     = meta.getOrDefault("lang",     "fr");
                String level    = meta.getOrDefault(KEY_LEVEL,    "B1");
                String scenario = meta.getOrDefault(KEY_SCENARIO, "");

                String content  = ollamaService.buildChatbotUserContent(userText, weakWords, pronScore, lang);
                String system   = ollamaService.getChatbotSystemPrompt(lang, level, scenario);

                // Build history for LLM (exclude the last user msg — we pass it as content above)
                List<Map<String, String>> history = historyCache.getOrDefault(sessionId, List.of());
                List<Map<String, String>> historyForLlm = (!history.isEmpty()
                        && "user".equals(history.get(history.size() - 1).get("role")))
                        ? new ArrayList<>(history.subList(0, history.size() - 1))
                        : new ArrayList<>(history);

                List<Map<String, Object>> messages =
                        ollamaService.buildChatbotMessagesList(historyForLlm, content, system);

                String response = ollamaService.streamChatbotResponse(messages, onToken);
                if (response == null || response.isBlank()) response = getFallbackResponse(lang);

                // Update history
                List<Map<String, String>> updated = new ArrayList<>(history);
                updated.add(Map.of("role", "user",      KEY_CONTENT, userText != null ? userText : ""));
                updated.add(Map.of("role", KEY_ASSISTANT, KEY_CONTENT, response));
                trimHistory(updated);
                historyCache.put(sessionId, updated);

                return response;
            } catch (Exception e) {
                log.error("Chat streaming error: {}", e.getMessage());
                String fallback = getFallbackResponse(null);
                if (onToken != null) onToken.accept(fallback);
                return fallback;
            }
        }, taskExecutor).orTimeout(55, TimeUnit.SECONDS);
    }

    /**
     * Version synchrone (compatible avec l'existant)
     */
    public String chat(String sessionId, String userText, List<String> weakWords, Double pronScore) {
        if (!lastUsed.containsKey(sessionId)) {
            throw new IllegalArgumentException("Session introuvable ou expirée: " + sessionId);
        }
        touch(sessionId);

        // Cache rapide
        String quick = getQuickResponse(userText);
        if (quick != null) return quick;

        return generateResponse(sessionId, userText, weakWords, pronScore);
    }

    /**
     * Version ultra-rapide pour UI réactive (< 50ms)
     */
    public String chatFast(String sessionId, String userText) {
        String quick = getQuickResponse(userText);
        if (quick != null) return quick;

        // Réponse temporaire pendant que LLM travaille
        taskExecutor.execute(() -> {
            try { chat(sessionId, userText, List.of(), null); }
            catch (Exception e) {
                if (e instanceof InterruptedException || e.getCause() instanceof InterruptedException) {
                    Thread.currentThread().interrupt();
                }
                log.debug("[Chatbot] Background prefetch failed: {}", e.getMessage());
            }
        });

        return "🤔 Je réfléchis... (ta prochaine réponse sera plus personnalisée)";
    }

    // ═════════════════════════════════════════════════════════════════════════
    // Noyau de génération
    // ═════════════════════════════════════════════════════════════════════════

    private String generateResponse(String sessionId, String userText, List<String> weakWords, Double pronScore) {
        try {
            RunnableConfig config = RunnableConfig.builder().threadId(sessionId).build();
            AgentState result = graph.invoke(Map.of(
                    KEY_USER_INPUT, userText != null ? userText : "",
                    KEY_WEAK_WORDS, weakWords != null ? weakWords : List.of(),
                    KEY_PRON_SCORE, pronScore != null ? pronScore : -1.0,
                    KEY_IS_GREETING, false
            ), config).orElseThrow(() -> new IllegalStateException("Agent state error"));

            String response = result.<String>value(KEY_LAST_RESPONSE).orElse(getFallbackResponse());

            result.<List<Map<String, String>>>value(KEY_HISTORY)
                    .ifPresent(h -> historyCache.put(sessionId, new ArrayList<>(h)));

            return response;
        } catch (Exception e) {
            throw new IllegalStateException("Failed to generate response in ChatbotAgent", e);
        }
    }

    public String startSession(String sessionId, String lang, String level, String scenario) {
        evictExpired();
        touch(sessionId);
        sessionMeta.put(sessionId, Map.of(
                "lang",     lang  != null ? lang     : "fr",
                KEY_LEVEL,    level != null ? level    : "B1",
                KEY_SCENARIO, scenario != null ? scenario : ""
        ));

        // Generate opening phrase via Ollama (async with 7s timeout — fallback if slow)
        String openingPhrase = null;
        try {
            openingPhrase = CompletableFuture
                    .supplyAsync(() -> ollamaService.generatePhrase(
                            lang != null ? lang : "fr",
                            level != null ? level : "B1"), taskExecutor)
                    .orTimeout(7, TimeUnit.SECONDS)
                    .get(7, TimeUnit.SECONDS);
        } catch (Exception e) {
            log.warn("[Chatbot] Greeting phrase timeout, using fallback");
        }
        String greeting = buildGreeting(lang, level, scenario, openingPhrase);

        try {
            RunnableConfig config = RunnableConfig.builder().threadId(sessionId).build();
            graph.invoke(Map.of(
                    "lang", lang, KEY_LEVEL, level, KEY_SCENARIO, scenario != null ? scenario : "",
                    KEY_USER_INPUT, "", KEY_WEAK_WORDS, List.of(), KEY_PRON_SCORE, -1.0,
                    KEY_IS_GREETING, true, "pending_assistant_msg", greeting
            ), config);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to initialize session in ChatbotAgent", e);
        }

        historyCache.put(sessionId, new ArrayList<>(List.of(Map.of("role", KEY_ASSISTANT, KEY_CONTENT, greeting))));
        return greeting;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // Cache intelligent
    // ═════════════════════════════════════════════════════════════════════════

    /**
     * Réponse rapide UNIQUEMENT pour messages très courts (≤12 car) qui sont des salutations pures.
     * Ne jamais intercepter des phrases complètes contenant ces mots — elles doivent aller au LLM.
     */
    private String getQuickResponse(String userText) {
        if (userText == null) return null;
        String lower = userText.toLowerCase().trim();
        if (lower.length() > 12) return null; // toute phrase > 12 chars va au LLM

        for (Map.Entry<String, String> entry : QUICK_RESPONSES.entrySet()) {
            String[] patterns = entry.getKey().split("\\|");
            for (String pattern : patterns) {
                if (lower.equals(pattern)) { // correspondance EXACTE seulement
                    log.debug("Quick response hit: {}", pattern);
                    return entry.getValue();
                }
            }
        }
        return null;
    }



    private void streamWithDelay(String text, Consumer<String> onToken, int delayMs) {
        String[] words = text.split(" ");
        for (int i = 0; i < words.length; i++) {
            String word = words[i] + (i < words.length - 1 ? " " : "");
            if (onToken != null) onToken.accept(word);
            try { Thread.sleep(delayMs); } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }
        }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // LangGraph4J nodes
    // ═════════════════════════════════════════════════════════════════════════

    @SuppressWarnings("unchecked")
    private Map<String, Object> prepareContextNode(AgentState state) {
        boolean isGreeting = state.<Boolean>value(KEY_IS_GREETING).orElse(false);
        String pendingMsg = state.<String>value("pending_assistant_msg").orElse("");

        List<Map<String, String>> history = new ArrayList<>(
                state.<List<Map<String, String>>>value(KEY_HISTORY).orElse(new ArrayList<>())
        );

        if (isGreeting && !pendingMsg.isBlank()) {
            history.add(Map.of("role", KEY_ASSISTANT, KEY_CONTENT, pendingMsg));
            trimHistory(history);
            return Map.of(KEY_HISTORY, history, KEY_SKIP_LLM, true, KEY_LAST_RESPONSE, pendingMsg);
        }

        String userInput = state.<String>value(KEY_USER_INPUT).orElse("");
        if (!userInput.isBlank()) {
            history.add(Map.of("role", "user", KEY_CONTENT, userInput));
            trimHistory(history);
        }

        return Map.of(KEY_HISTORY, history, KEY_SKIP_LLM, false);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> generateResponseNode(AgentState state) {
        if (state.<Boolean>value(KEY_SKIP_LLM).orElse(false)) {
            return Map.of();
        }

        String lang = state.<String>value("lang").orElse("fr");
        String level = state.<String>value(KEY_LEVEL).orElse("B1");
        String scenario = state.<String>value(KEY_SCENARIO).orElse("");
        String userInput = state.<String>value(KEY_USER_INPUT).orElse("");

        List<String> weakWords = state.<List<String>>value(KEY_WEAK_WORDS).orElse(List.of());
        double pronScoreRaw = state.<Double>value(KEY_PRON_SCORE).orElse(-1.0);
        Double pronScoreArg = pronScoreRaw >= 0 ? pronScoreRaw : null;

        List<Map<String, String>> history = state.<List<Map<String, String>>>value(KEY_HISTORY).orElse(List.of());

        // BUG FIX: prepareContextNode a déjà ajouté le message user à history.
        // generateChatbotResponse va le rajouter AVEC les hints de prononciation.
        // → on exclut le dernier message user pour éviter la duplication dans le prompt LLM.
        List<Map<String, String>> historyForLlm = (!history.isEmpty()
                && "user".equals(history.get(history.size() - 1).get("role")))
                ? new ArrayList<>(history.subList(0, history.size() - 1))
                : new ArrayList<>(history);

        String response;
        try {
            response = CompletableFuture.supplyAsync(() ->
                            ollamaService.generateChatbotResponse(historyForLlm, userInput, weakWords, pronScoreArg, lang, level, scenario),
                    taskExecutor
            ).orTimeout(25, TimeUnit.SECONDS).get(25, TimeUnit.SECONDS);

            if (response == null || response.isBlank()) response = getFallbackResponse(lang);
        } catch (Exception e) {
            log.error("LLM error: {}", e.getMessage());
            response = getFallbackResponse(lang);
        }

        List<Map<String, String>> updated = new ArrayList<>(history);
        updated.add(Map.of("role", KEY_ASSISTANT, KEY_CONTENT, response));
        trimHistory(updated);

        return Map.of(KEY_HISTORY, updated, KEY_LAST_RESPONSE, response);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // Helpers
    // ═════════════════════════════════════════════════════════════════════════

    private String getFallbackResponse(String lang) {
        return "en".equals(lang)
            ? "I'm processing your message — please try again in a moment! 🙏"
            : "Je traite ta réponse, peux-tu réessayer dans un instant ? 🙏";
    }

    @SuppressWarnings("unused")
    private String getFallbackResponse() { return getFallbackResponse(null); }

    public static String buildGreeting(String lang, String level, String scenario, String generatedPhrase) {
        if (scenario != null && !scenario.isBlank()) {
            return buildRoleplayGreeting(lang, scenario);
        }
        boolean isEn = "en".equals(lang);

        // Use Ollama-generated phrase if available, otherwise use a level-appropriate fallback
        String phrase;
        if (generatedPhrase != null && !generatedPhrase.isBlank()) {
            phrase = generatedPhrase;
        } else if (isEn) {
            phrase = switch (level != null ? level : "B1") {
                case "A1" -> "Hello, how are you today?";
                case "A2" -> "I enjoy spending time with my friends";
                case "B1" -> "The weekend was really enjoyable and relaxing";
                case "B2" -> "It is important to keep learning throughout life";
                default   -> "Every experience shapes who we are as people";
            };
        } else {
            phrase = switch (level != null ? level : "B1") {
                case "A1" -> "Bonjour, comment vas-tu ?";
                case "A2" -> "J'aime passer du temps avec mes amis";
                case "B1" -> "Le week-end était vraiment agréable et reposant";
                case "B2" -> "Il est important de continuer à apprendre tout au long de la vie";
                default   -> "Chaque expérience façonne qui nous sommes en tant que personnes";
            };
        }

        String tag   = isEn ? "[REPEAT: \"%s\"]" : "[RÉPÈTE: \"%s\"]";
        String intro = isEn
            ? "Hi! I'm your AI Coach 🎙 Level " + level + ". Let's warm up — repeat this: "
            : "Salut ! Je suis ton Coach IA 🎙 Niveau " + level + ". On s'échauffe — répète : ";
        return intro + tag.formatted(phrase);
    }

    public static String buildRoleplayGreeting(String lang, String scenario) {
        boolean isEn = "en".equals(lang);
        if (isEn) return switch (scenario) {
            case "customs"    -> "Good day, UK Border Control. 🛂 Passport and purpose of visit, please?";
            case "interview"  -> "Hello, I'm the hiring manager. 💼 Tell me a bit about yourself.";
            case "restaurant" -> "Good evening! 🍽 Welcome. Do you have a reservation?";
            default           -> "Hello! Ready for our roleplay? 🎯";
        };
        return switch (scenario) {
            case "customs"    -> "Bonjour, douanes françaises. 🛂 Passeport et motif du séjour ?";
            case "interview"  -> "Bonjour, je suis le DRH. 💼 Présentez-vous brièvement.";
            case "restaurant" -> "Bonsoir ! 🍽 Bienvenue. Avez-vous une réservation ?";
            default           -> "Bonjour ! Prêt(e) pour la simulation ? 🎯";
        };
    }

    /**
     * Updates the CEFR level for an existing session (called by MasterAgent after TEST finishes).
     * Replaces the immutable Map.of() with a mutable copy so the new level takes effect.
     */
    public void updateLevel(String sessionId, String newLevel) {
        sessionMeta.computeIfPresent(sessionId, (k, old) -> {
            Map<String, String> updated = new java.util.HashMap<>(old);
            updated.put(KEY_LEVEL, newLevel != null ? newLevel : "B1");
            return updated;
        });
        log.info("[Chatbot] Level updated for session {}: {}", sessionId, newLevel);
    }

    public void endSession(String sessionId) {
        lastUsed.remove(sessionId);
        historyCache.remove(sessionId);
        streamCallbacks.remove(sessionId);
        sessionMeta.remove(sessionId);
    }

    public List<Map<String, String>> getHistory(String sessionId) {
        return List.copyOf(historyCache.getOrDefault(sessionId, List.of()));
    }

    public boolean sessionExists(String sessionId) {
        Long ts = lastUsed.get(sessionId);
        return ts != null && (System.currentTimeMillis() - ts) < SESSION_TTL_MS;
    }

    private void touch(String sessionId) {
        lastUsed.put(sessionId, System.currentTimeMillis());
    }

    private void evictExpired() {
        long now = System.currentTimeMillis();
        lastUsed.entrySet().removeIf(e -> (now - e.getValue()) > SESSION_TTL_MS);
    }

    private static void trimHistory(List<Map<String, String>> history) {
        if (history.size() > MAX_HISTORY) {
            history.subList(0, history.size() - MAX_HISTORY).clear();
        }
    }
}