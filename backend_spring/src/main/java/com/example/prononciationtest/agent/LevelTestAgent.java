package com.example.prononciationtest.agent;

import com.example.prononciationtest.config.LevelTestConfig;
import com.example.prononciationtest.service.OllamaService;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
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
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Retryable;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.stream.Collectors;

import static org.bsc.langgraph4j.StateGraph.END;
import static org.bsc.langgraph4j.StateGraph.START;

@Component
public class LevelTestAgent {

    private static final Logger log = LoggerFactory.getLogger(LevelTestAgent.class);
    private static final int TOTAL_STEPS = 20;

    // ── Sound data (fr) ───────────────────────────────────────────────────────
    private static final Map<String, String> SOUND_CONTEXT_FR = new HashMap<>();
    private static final Map<String, String> SOUND_LABELS_FR = new HashMap<>();
    private static final Map<String, String> SOUND_CONTEXT_EN = new HashMap<>();
    private static final Map<String, String> SOUND_LABELS_EN = new HashMap<>();
    private static final Map<String, Map<String, String>> FALLBACK_PHRASES = new HashMap<>();
    private static final Map<String, Map<String, String>> FALLBACK_TIPS = new HashMap<>();

    static {
        // FR Context
        SOUND_CONTEXT_FR.put("r", "rouge, renard, bruit, Paris, partir, crier, brosse");
        SOUND_CONTEXT_FR.put("u", "rue, vu, bu, tu, sur, lune, bureau, futur");
        SOUND_CONTEXT_FR.put("in_nasal", "main, vin, pain, lapin, cousin, matin, dessin");
        SOUND_CONTEXT_FR.put("on_nasal", "bon, pont, balcon, mouton, chanson, salon");
        SOUND_CONTEXT_FR.put("an_nasal", "grand, enfant, temps, vent, chanter, devant");
        SOUND_CONTEXT_FR.put("eu", "deux, feu, heureux, beurre, sœur, bleu");
        SOUND_CONTEXT_FR.put("gn", "montagne, vigne, gagner, signe, campagne");
        SOUND_CONTEXT_FR.put("liaison", "les_enfants, vous_avez, ils_ont, un_ami, en_avant");
        SOUND_CONTEXT_FR.put("ch", "chat, chose, chercher, chocolat, perche");
        SOUND_CONTEXT_FR.put("j", "je, jour, jeu, jardin, plage, image");
        SOUND_CONTEXT_FR.put("ou", "roue, cou, tout, sous, nous, jour, bouche");
        SOUND_CONTEXT_FR.put("oi", "moi, toi, roi, choix, voiture, poisson");

        // FR Labels
        SOUND_LABELS_FR.put("r", "Le R grasseyé [ʁ]");
        SOUND_LABELS_FR.put("u", "Le U français [y]");
        SOUND_LABELS_FR.put("in_nasal", "La nasale IN [ɛ̃]");
        SOUND_LABELS_FR.put("on_nasal", "La nasale ON [ɔ̃]");
        SOUND_LABELS_FR.put("an_nasal", "La nasale AN [ɑ̃]");
        SOUND_LABELS_FR.put("eu", "Le son EU [ø/œ]");
        SOUND_LABELS_FR.put("gn", "Le son GN [ɲ]");
        SOUND_LABELS_FR.put("liaison", "Les liaisons");
        SOUND_LABELS_FR.put("ch", "Le CH [ʃ]");
        SOUND_LABELS_FR.put("j", "Le J / GE [ʒ]");
        SOUND_LABELS_FR.put("ou", "Le OU [u]");
        SOUND_LABELS_FR.put("oi", "Le OI [wa]");

        // EN Context
        SOUND_CONTEXT_EN.put("th", "think, the, three, that, both, through, weather");
        SOUND_CONTEXT_EN.put("r", "river, road, rain, run, arrive, current, worry");
        SOUND_CONTEXT_EN.put("ae", "cat, hat, bag, man, black, hand, stand, plan");
        SOUND_CONTEXT_EN.put("short_i", "sit, him, big, fish, ring, win, ship, bit");
        SOUND_CONTEXT_EN.put("ng", "running, singing, ring, king, bring, thing, wrong");
        SOUND_CONTEXT_EN.put("w", "water, walk, wind, world, wave, warm, window");
        SOUND_CONTEXT_EN.put("v", "voice, very, visit, village, love, live, above");
        SOUND_CONTEXT_EN.put("schwa", "the, a, about, teacher, doctor, problem, system");
        SOUND_CONTEXT_EN.put("diphthong", "day, time, boy, go, now, own, say, high");
        SOUND_CONTEXT_EN.put("dark_l", "ball, full, milk, fall, tall, call, felt");

        // EN Labels
        SOUND_LABELS_EN.put("th", "The TH sound [θ/ð]");
        SOUND_LABELS_EN.put("r", "American R [ɹ]");
        SOUND_LABELS_EN.put("ae", "Flat A [æ]");
        SOUND_LABELS_EN.put("short_i", "Short I [ɪ]");
        SOUND_LABELS_EN.put("ng", "NG ending [ŋ]");
        SOUND_LABELS_EN.put("w", "The W sound [w]");
        SOUND_LABELS_EN.put("v", "The V sound [v]");
        SOUND_LABELS_EN.put("schwa", "The Schwa [ə]");
        SOUND_LABELS_EN.put("diphthong", "Diphthongs [eɪ/aɪ]");
        SOUND_LABELS_EN.put("dark_l", "Dark L [ɫ]");

        // Fallback Phrases FR
        Map<String, String> frPhrases = new HashMap<>();
        frPhrases.put("r", "Le renard rouge court dans la forêt.");
        frPhrases.put("u", "La lune est visible dans le ciel bleu.");
        frPhrases.put("in_nasal", "Le lapin mange du pain le matin.");
        frPhrases.put("on_nasal", "Le mouton broute dans le salon.");
        frPhrases.put("an_nasal", "L'enfant chante sous la pluie de vent.");
        frPhrases.put("eu", "Les deux amis sont heureux ensemble.");
        frPhrases.put("gn", "La montagne est couverte de vigne.");
        frPhrases.put("liaison", "Les amis ont un ami en avance.");
        frPhrases.put("ch", "Le chat cherche le chocolat chaud.");
        frPhrases.put("j", "Je joue dans le jardin chaque jour.");
        FALLBACK_PHRASES.put("fr", frPhrases);

        // Fallback Phrases EN
        Map<String, String> enPhrases = new HashMap<>();
        enPhrases.put("th", "I think the weather is getting better.");
        enPhrases.put("r", "The river runs through the rainy road.");
        enPhrases.put("ae", "The cat sat on the black hat.");
        enPhrases.put("short_i", "The fish swam in the big ship.");
        enPhrases.put("ng", "She is running and singing a song.");
        enPhrases.put("w", "The warm water flows by the window.");
        enPhrases.put("v", "The voice of the village is very calm.");
        enPhrases.put("schwa", "The teacher helped the doctor with the problem.");
        enPhrases.put("diphthong", "The day is high and the time flies away.");
        enPhrases.put("dark_l", "The ball fell on the tall wall.");
        FALLBACK_PHRASES.put("en", enPhrases);

        // Fallback Tips FR
        Map<String, String> frTips = new HashMap<>();
        frTips.put("r", "Pour le R français, faites vibrer le fond de la gorge.");
        frTips.put("u", "Arrondissez les lèvres comme pour siffler et dites 'i'.");
        frTips.put("in_nasal", "Laissez l'air passer par le nez.");
        frTips.put("on_nasal", "Arrondissez les lèvres, air par le nez.");
        frTips.put("an_nasal", "Ouvrez la bouche, langue vers le bas.");
        frTips.put("eu", "Arrondissez les lèvres comme pour 'o' et dites 'é'.");
        frTips.put("gn", "Collez la langue au palais.");
        frTips.put("liaison", "Enchaînez les mots naturellement.");
        frTips.put("ch", "Avancez les lèvres, soufflez doucement.");
        frTips.put("j", "Faites vibrer les cordes vocales.");
        FALLBACK_TIPS.put("fr", frTips);

        // Fallback Tips EN
        Map<String, String> enTips = new HashMap<>();
        enTips.put("th", "Place your tongue lightly between your teeth and blow.");
        enTips.put("r", "Curl your tongue back slightly.");
        enTips.put("ae", "Open your mouth wide, push your tongue forward.");
        enTips.put("short_i", "Relax your tongue, shorter than long 'ee'.");
        enTips.put("ng", "Close the back of your throat like humming.");
        enTips.put("w", "Round your lips tightly first, then release.");
        enTips.put("v", "Touch your upper teeth to your lower lip.");
        enTips.put("schwa", "Most relaxed vowel, mouth almost closed.");
        enTips.put("diphthong", "Start on one vowel and glide smoothly.");
        enTips.put("dark_l", "Raise the back of your tongue toward the soft palate.");
        FALLBACK_TIPS.put("en", enTips);
    }

    // ── Dependencies ──
    private final OllamaService ollamaService;
    private final ThreadPoolTaskExecutor taskExecutor;
    private final LevelTestConfig config;

    private org.bsc.langgraph4j.CompiledGraph<AgentState> graph;
    private final MemorySaver checkpointer = new MemorySaver();

    private final Cache<String, AgentState> stateCache;
    private final Cache<String, String> phraseCache;
    private final Cache<String, String> tipCache;

    @Autowired
    public LevelTestAgent(
            OllamaService ollamaService,
            ThreadPoolTaskExecutor taskExecutor,
            LevelTestConfig config) {
        this.ollamaService = ollamaService;
        this.taskExecutor = taskExecutor;
        this.config = config;

        this.stateCache = Caffeine.newBuilder()
                .expireAfterAccess(Duration.ofMinutes(30))
                .maximumSize(200)
                .recordStats()
                .build();

        this.phraseCache = Caffeine.newBuilder()
                .expireAfterWrite(Duration.ofHours(1))
                .maximumSize(500)
                .recordStats()
                .build();

        this.tipCache = Caffeine.newBuilder()
                .expireAfterWrite(Duration.ofHours(1))
                .maximumSize(500)
                .recordStats()
                .build();
    }

    @PostConstruct
    void buildGraph() throws Exception {
        log.info("[LevelTestAgent] Building LangGraph...");

        graph = new StateGraph<>(AgentState::new)

                .addConditionalEdges(START,
                        state -> CompletableFuture.completedFuture(
                                state.<String>value("action").orElse("next")),
                        Map.of(
                                "start", "pick_sound",
                                "next", "gen_feedback",
                                "feedback_only", "gen_feedback",
                                "next_phrase", "pick_sound",
                                "finish", "synthesize"
                        ))

                .addNode("pick_sound", (state, runnableConfig) ->
                        CompletableFuture.completedFuture(pickSoundNode(state)))
                .addEdge("pick_sound", "gen_content")

                .addNode("gen_content", (state, runnableConfig) ->
                        CompletableFuture.completedFuture(genContentNode(state)))
                .addEdge("gen_content", END)

                .addNode("gen_feedback", (state, runnableConfig) ->
                        CompletableFuture.completedFuture(genFeedbackNode(state)))
                .addConditionalEdges("gen_feedback",
                        state -> CompletableFuture.completedFuture(
                                state.<Boolean>value("done").orElse(false) ? "done" :
                                        "feedback_only".equals(state.<String>value("action").orElse("next")) ? "stop" : "continue"),
                        Map.of("continue", "pick_sound", "done", "synthesize", "stop", END))

                .addNode("synthesize", (state, runnableConfig) ->
                        CompletableFuture.completedFuture(synthesizeNode(state)))
                .addEdge("synthesize", END)

                .compile(CompileConfig.builder().checkpointSaver(checkpointer).build());

        log.info("[LevelTestAgent] Graph built successfully");
    }

    @PreDestroy
    void cleanup() {
        log.info("[LevelTestAgent] Shutting down...");
        stateCache.invalidateAll();
        phraseCache.invalidateAll();
        tipCache.invalidateAll();
    }

    // ═════════════════════════════════════════════════════════════════════════
    // Public API
    // ═════════════════════════════════════════════════════════════════════════

    public Map<String, Object> start(String sessionId, String lang) {
        validateSessionId(sessionId);

        try {
            RunnableConfig config = RunnableConfig.builder().threadId(sessionId).build();
            AgentState result = graph.invoke(
                    Map.of("lang", lang, "action", "start"),
                    config
            ).orElseThrow(() -> new RuntimeException("Agent state empty after start"));

            stateCache.put(sessionId, result);
            return buildStepResponse(result, lang, sessionId);
        } catch (Exception e) {
            log.error("start() failed for session {}: {}", sessionId, e.getMessage());
            throw new RuntimeException("Failed to start test: " + e.getMessage(), e);
        }
    }

    @Retryable(value = {TimeoutException.class}, maxAttempts = 2, backoff = @Backoff(delay = 1000))
    public Map<String, Object> next(String sessionId, int score, String phrase) {
        validateInputs(sessionId, score, phrase);

        try {
            RunnableConfig config = RunnableConfig.builder().threadId(sessionId).build();
            AgentState result = graph.invoke(
                    Map.of("action", "next", "input_score", score, "input_phrase", phrase != null ? phrase : ""),
                    config
            ).orElseThrow(() -> new RuntimeException("Agent state empty after next"));

            stateCache.put(sessionId, result);

            boolean done = result.<Boolean>value("done").orElse(false);
            if (done) {
                return buildFinishResponse(result);
            }

            Map<String, Object> resp = new LinkedHashMap<>(buildStepResponse(result,
                    result.<String>value("lang").orElse("fr"), sessionId));
            resp.put("feedback", result.<String>value("last_feedback").orElse(""));
            return resp;
        } catch (Exception e) {
            log.error("next() failed for session {}: {}", sessionId, e.getMessage());
            throw new RuntimeException("Failed to process next step: " + e.getMessage(), e);
        }
    }

    public Map<String, Object> submitFeedback(String sessionId, int score, String phrase) {
        validateInputs(sessionId, score, phrase);

        try {
            RunnableConfig config = RunnableConfig.builder().threadId(sessionId).build();
            AgentState result = graph.invoke(
                    Map.of("action", "feedback_only", "input_score", score, "input_phrase", phrase != null ? phrase : ""),
                    config
            ).orElseThrow(() -> new RuntimeException("Agent state empty after submitFeedback"));

            stateCache.put(sessionId, result);

            boolean done = result.<Boolean>value("done").orElse(false);
            if (done) return buildFinishResponse(result);

            Map<String, Object> resp = new LinkedHashMap<>();
            resp.put("feedback", result.<String>value("last_feedback").orElse(""));
            resp.put("estimated_level", result.<String>value("estimated_level").orElse("B1"));
            resp.put("done", false);
            return resp;
        } catch (Exception e) {
            log.error("submitFeedback() failed for session {}: {}", sessionId, e.getMessage());
            throw new RuntimeException("Failed to submit feedback: " + e.getMessage(), e);
        }
    }

    public Map<String, Object> fetchNextPhrase(String sessionId) {
        validateSessionId(sessionId);

        try {
            RunnableConfig config = RunnableConfig.builder().threadId(sessionId).build();
            AgentState result = graph.invoke(
                    Map.of("action", "next_phrase"),
                    config
            ).orElseThrow(() -> new RuntimeException("Agent state empty after fetchNextPhrase"));

            stateCache.put(sessionId, result);

            String lang = result.<String>value("lang").orElse("fr");
            return buildStepResponse(result, lang, sessionId);
        } catch (Exception e) {
            log.error("fetchNextPhrase() failed for session {}: {}", sessionId, e.getMessage());
            throw new RuntimeException("Failed to fetch next phrase: " + e.getMessage(), e);
        }
    }

    public Map<String, Object> finish(String sessionId) {
        validateSessionId(sessionId);

        try {
            RunnableConfig config = RunnableConfig.builder().threadId(sessionId).build();
            AgentState result = graph.invoke(
                    Map.of("action", "finish"),
                    config
            ).orElseThrow(() -> new RuntimeException("Agent state empty after finish"));

            stateCache.invalidate(sessionId);
            return buildFinishResponse(result);
        } catch (Exception e) {
            log.error("finish() failed for session {}: {}", sessionId, e.getMessage());
            throw new RuntimeException("Failed to finish test: " + e.getMessage(), e);
        }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // Validation
    // ═════════════════════════════════════════════════════════════════════════

    private void validateSessionId(String sessionId) {
        if (sessionId == null || sessionId.isBlank()) {
            throw new IllegalArgumentException("Session ID is required");
        }
    }

    private void validateInputs(String sessionId, int score, String phrase) {
        validateSessionId(sessionId);
        if (score < 0 || score > 100) {
            throw new IllegalArgumentException("Score must be between 0 and 100");
        }
        if (phrase != null && phrase.length() > 500) {
            throw new IllegalArgumentException("Phrase too long (max 500 chars)");
        }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // LangGraph4J nodes
    // ═════════════════════════════════════════════════════════════════════════

    private Map<String, Object> pickSoundNode(AgentState state) {
        String lang = state.<String>value("lang").orElse("fr");

        @SuppressWarnings("unchecked")
        List<String> queue = new ArrayList<>(state.<List<String>>value("sound_queue")
                .filter(q -> !q.isEmpty())
                .orElseGet(() -> buildSoundQueue(lang)));

        // Sounds the user mastered (≥75) in THIS session → skip their repetitions
        @SuppressWarnings("unchecked")
        Set<String> masteredSounds = state.<List<Map<String, Object>>>value("history")
                .orElse(List.of()).stream()
                .filter(h -> h.get("score") instanceof Number n && n.intValue() >= 75)
                .map(h -> (String) h.getOrDefault("sound", ""))
                .filter(s -> !s.isBlank())
                .collect(Collectors.toSet());

        int step        = state.<Integer>value("current_step").orElse(0);
        int displayStep = state.<Integer>value("display_step").orElse(0);

        // Advance past repeated mastered sounds (first occurrence always shown)
        while (step < queue.size() && masteredSounds.contains(queue.get(step))) {
            log.debug("[LevelTest] Skipping mastered sound '{}' at queue pos {}", queue.get(step), step);
            step++;
        }

        if (step >= queue.size() || displayStep >= TOTAL_STEPS) {
            return Map.of("done", true, "sound_queue", queue,
                          "current_step", step, "display_step", displayStep);
        }

        String soundKey   = queue.get(step);
        String soundLabel = getSoundLabel(lang, soundKey);

        return Map.of(
                "sound_queue",   queue,
                "current_step",  step,
                "display_step",  displayStep,
                "current_sound", soundKey,
                "current_label", soundLabel,
                "done",          false
        );
    }

    private Map<String, Object> genContentNode(AgentState state) {
        String lang = state.<String>value("lang").orElse("fr");
        String soundKey = state.<String>value("current_sound").orElse("");
        String soundLabel = state.<String>value("current_label").orElse("");
        String level = state.<String>value("estimated_level").orElse("B1");

        // Track phrases already shown in this session to avoid repetition
        @SuppressWarnings("unchecked")
        Set<String> usedPhrases = new HashSet<>(
                state.<List<String>>value("used_phrases").orElse(List.of())
        );

        String cacheKey = lang + ":" + soundKey + ":" + level;
        String cachedPhrase = phraseCache.getIfPresent(cacheKey);
        String cachedTip = tipCache.getIfPresent(cacheKey);

        // Skip cache hit if this phrase was already shown in this session
        if (cachedPhrase != null && usedPhrases.contains(cachedPhrase)) {
            log.debug("Cached phrase already used this session for sound {}, regenerating", soundKey);
            cachedPhrase = null;
        }

        if (cachedPhrase != null && cachedTip != null) {
            log.debug("Cache hit for sound: {}", soundKey);
            usedPhrases.add(cachedPhrase);
            return Map.of("current_phrase", cachedPhrase, "current_tip", cachedTip,
                          "used_phrases", new ArrayList<>(usedPhrases));
        }

        String soundContext = getSoundContext(lang, soundKey);
        String levelHint = getLevelHint(lang, level);
        int timeoutSeconds = config.getTimeouts().getPhraseGeneration();

        CompletableFuture<String> phraseFut = CompletableFuture.supplyAsync(
                () -> generatePhraseWithRetry(lang, soundContext, level, soundKey),
                taskExecutor
        ).orTimeout(timeoutSeconds, TimeUnit.SECONDS);

        CompletableFuture<String> tipFut = CompletableFuture.supplyAsync(
                () -> generateTipWithRetry(lang, soundLabel, soundKey),
                taskExecutor
        ).orTimeout(timeoutSeconds, TimeUnit.SECONDS);

        String phrase, tip;
        try {
            phrase = phraseFut.get(timeoutSeconds, TimeUnit.SECONDS);
            tip = tipFut.get(timeoutSeconds, TimeUnit.SECONDS);

            if (phrase != null && phrase.length() >= 10) {
                phraseCache.put(cacheKey, phrase);
            }
            if (tip != null && tip.length() > 10) {
                tipCache.put(cacheKey, tip);
            }
        } catch (Exception e) {
            log.warn("Generation failed: {}", e.getMessage());
            phrase = getFallbackPhrase(lang, soundKey, soundContext, level);
            tip = getFallbackTip(lang, soundKey);
        }

        usedPhrases.add(phrase);
        return Map.of("current_phrase", phrase, "current_tip", tip,
                      "used_phrases", new ArrayList<>(usedPhrases));
    }

    private String generatePhraseWithRetry(String lang, String context, String level, String soundKey) {
        try {
            String phrase = ollamaService.generateLevelTestPhrase(lang, context, level);
            if (phrase != null && phrase.length() >= 10) {
                return phrase;
            }
        } catch (Exception e) {
            log.warn("Ollama phrase generation failed: {}", e.getMessage());
        }
        return getFallbackPhrase(lang, soundKey, context, level);
    }

    private String generateTipWithRetry(String lang, String soundLabel, String soundKey) {
        try {
            String tip = ollamaService.generateLevelTestTip(lang, soundLabel);
            if (tip != null && tip.length() > 10) {
                return tip;
            }
        } catch (Exception e) {
            log.warn("Ollama tip generation failed: {}", e.getMessage());
        }
        return getFallbackTip(lang, soundKey);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> genFeedbackNode(AgentState state) {
        String lang = state.<String>value("lang").orElse("fr");
        String soundKey = state.<String>value("current_sound").orElse("");
        String soundLabel = getSoundLabel(lang, soundKey);
        String phrase = state.<String>value("input_phrase").orElse("");
        int score = state.<Integer>value("input_score").orElse(0);
        String context = getSoundContext(lang, soundKey);

        String feedback;
        try {
            feedback = CompletableFuture.supplyAsync(
                            () -> ollamaService.generateLevelTestFeedback(lang, soundLabel, context, phrase, score),
                            taskExecutor
                    ).orTimeout(config.getTimeouts().getFeedbackGeneration(), TimeUnit.SECONDS)
                    .get(config.getTimeouts().getFeedbackGeneration(), TimeUnit.SECONDS);
        } catch (Exception e) {
            log.warn("Feedback generation failed: {}", e.getMessage());
            feedback = buildFallbackFeedback(lang, soundLabel, score);
        }

        List<Map<String, Object>> history = new ArrayList<>(
                state.<List<Map<String, Object>>>value("history").orElse(new ArrayList<>())
        );
        int step = state.<Integer>value("current_step").orElse(0);
        history.add(Map.of(
                "step", step + 1,
                "sound", soundKey,
                "sound_label", soundLabel,
                "phrase", phrase,
                "score", score
        ));

        List<Integer> scores = history.stream()
                .map(h -> (Integer) h.get("score"))
                .collect(Collectors.toList());

        int displayStep     = state.<Integer>value("display_step").orElse(0);
        int nextStep        = step + 1;
        int nextDisplayStep = displayStep + 1;
        boolean done        = nextDisplayStep >= TOTAL_STEPS;

        return Map.of(
                "history",         history,
                "current_step",    nextStep,
                "display_step",    nextDisplayStep,
                "estimated_level", computeLevel(scores),
                "last_feedback",   feedback,
                "done", done
        );
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> synthesizeNode(AgentState state) {
        String lang = state.<String>value("lang").orElse("fr");
        String finalLevel = computeCefr(state.<List<Map<String, Object>>>value("history").orElse(List.of()));
        List<Map<String, Object>> history = state.<List<Map<String, Object>>>value("history").orElse(List.of());

        String synthesis;
        try {
            synthesis = CompletableFuture.supplyAsync(
                            () -> ollamaService.generateLevelTestSynthesis(lang, history, finalLevel),
                            taskExecutor
                    ).orTimeout(config.getTimeouts().getSynthesisGeneration(), TimeUnit.SECONDS)
                    .get(config.getTimeouts().getSynthesisGeneration(), TimeUnit.SECONDS);
        } catch (Exception e) {
            log.warn("Synthesis generation failed: {}", e.getMessage());
            synthesis = buildFallbackSynthesis(lang, history, finalLevel);
        }

        List<String> mastered = new ArrayList<>();
        List<String> toWork = new ArrayList<>();
        for (Map<String, Object> h : history) {
            int sc = h.get("score") instanceof Number n ? n.intValue() : 0;
            String label = (String) h.getOrDefault("sound_label", "");
            if (sc >= 70) mastered.add(label);
            else if (sc < 50) toWork.add(label);
        }

        return Map.of(
                "final_level", finalLevel,
                "synthesis", synthesis,
                "strengths", mastered.stream().limit(5).collect(Collectors.toList()),
                "weaknesses", toWork.stream().limit(5).collect(Collectors.toList()),
                "done", true
        );
    }

    // ═════════════════════════════════════════════════════════════════════════
    // CEFR computation
    // ═════════════════════════════════════════════════════════════════════════

    public static String computeLevel(List<Integer> scores) {
        if (scores == null || scores.isEmpty()) return "B1";
        double avg = scores.stream().mapToInt(Integer::intValue).average().orElse(50);
        if (avg >= 85) return "C2";
        if (avg >= 80) return "C1";
        if (avg >= 65) return "B2";
        if (avg >= 50) return "B1";
        if (avg >= 35) return "A2";
        return "A1";
    }

    @SuppressWarnings("unchecked")
    public static String computeCefr(List<Map<String, Object>> history) {
        if (history == null || history.isEmpty()) return "B1";
        int n = history.size();
        double weightedSum = 0, weightTotal = 0;
        for (int i = 0; i < n; i++) {
            double w = 1.0 + (double) i / n;
            int sc = history.get(i).get("score") instanceof Number num ? num.intValue() : 0;
            weightedSum += sc * w;
            weightTotal += w;
        }
        double avg = weightedSum / weightTotal;
        if (avg >= 85) return "C2";
        if (avg >= 80) return "C1";
        if (avg >= 65) return "B2";
        if (avg >= 50) return "B1";
        if (avg >= 35) return "A2";
        return "A1";
    }

    // ═════════════════════════════════════════════════════════════════════════
    // Helpers
    // ═════════════════════════════════════════════════════════════════════════

    private List<String> buildSoundQueue(String lang) {
        List<String> keys = new ArrayList<>(
                "fr".equals(lang) ? SOUND_CONTEXT_FR.keySet() : SOUND_CONTEXT_EN.keySet()
        );
        // Build 20-step queue: two shuffled passes so each sound appears ≤2 times
        List<String> pass1 = new ArrayList<>(keys);
        List<String> pass2 = new ArrayList<>(keys);
        Collections.shuffle(pass1);
        Collections.shuffle(pass2);
        List<String> queue = new ArrayList<>();
        queue.addAll(pass1);
        queue.addAll(pass2);
        queue = new ArrayList<>(queue.subList(0, TOTAL_STEPS));

        // Ensure no two consecutive entries are the same
        for (int i = 1; i < queue.size(); i++) {
            if (queue.get(i).equals(queue.get(i - 1))) {
                for (int j = i + 1; j < queue.size(); j++) {
                    if (!queue.get(j).equals(queue.get(i - 1))) {
                        Collections.swap(queue, i, j);
                        break;
                    }
                }
            }
        }
        return queue;
    }

    private String getSoundLabel(String lang, String key) {
        return "fr".equals(lang)
                ? SOUND_LABELS_FR.getOrDefault(key, key)
                : SOUND_LABELS_EN.getOrDefault(key, key);
    }

    private String getSoundContext(String lang, String key) {
        return "fr".equals(lang)
                ? SOUND_CONTEXT_FR.getOrDefault(key, key)
                : SOUND_CONTEXT_EN.getOrDefault(key, key);
    }

    private String getLevelHint(String lang, String level) {
        if ("fr".equals(lang)) {
            switch (level) {
                case "A1": return "très simple (4-6 mots)";
                case "A2": return "simple (6-8 mots)";
                case "B1": return "intermédiaire (9-12 mots)";
                case "B2": return "avancé (12-15 mots)";
                case "C1": return "sophistiqué (15-18 mots)";
                case "C2": return "très sophistiqué (18-22 mots)";
                default: return "intermédiaire";
            }
        } else {
            switch (level) {
                case "A1": return "very simple (4-6 words)";
                case "A2": return "simple (6-8 words)";
                case "B1": return "intermediate (9-12 words)";
                case "B2": return "advanced (12-15 words)";
                case "C1": return "sophisticated (15-18 words)";
                case "C2": return "very sophisticated (18-22 words)";
                default: return "intermediate";
            }
        }
    }

    private static final Random RNG = new Random();

    private String getFallbackPhrase(String lang, String soundKey, String context, String level) {
        Map<String, String> fallbacks = FALLBACK_PHRASES.getOrDefault(lang, FALLBACK_PHRASES.get("en"));
        String fallback = fallbacks.get(soundKey);
        
        String firstWord = context.split(",")[0].trim();
        String gen = "fr".equals(lang)
                ? "Je pratique " + firstWord + " chaque jour."
                : "I practice " + firstWord + " every day.";
                
        // Return fallback but add a slight variation if we already used it
        // Since we don't track it here directly, we can just return the fallback 
        // with a 50% chance of appending a small variation or using another word.
        if (fallback != null) {
            if (RNG.nextBoolean()) return fallback;
            String secondWord = context.split(",").length > 1 ? context.split(",")[1].trim() : firstWord;
            return "fr".equals(lang) 
                ? "Le mot " + secondWord + " est important pour ce niveau."
                : "The word " + secondWord + " is important for this level.";
        }
        return gen;
    }

    private String getFallbackTip(String lang, String soundKey) {
        Map<String, String> tips = FALLBACK_TIPS.getOrDefault(lang, FALLBACK_TIPS.get("en"));
        String tip = tips.get(soundKey);
        return tip != null ? tip :
                ("fr".equals(lang) ? "Entraînez-vous lentement puis accélérez." : "Practice slowly, then speed up.");
    }

    private String buildFallbackFeedback(String lang, String soundLabel, int score) {
        if ("fr".equals(lang)) {
            if (score >= 75) return "Excellent ! Le son " + soundLabel + " est bien maîtrisé. 🌟";
            if (score >= 55) return "Bien joué ! Le son " + soundLabel + " est presque parfait. 👍";
            return "Le son " + soundLabel + " nécessite plus de pratique. Continue ! 💪";
        } else {
            if (score >= 75) return "Excellent! The " + soundLabel + " sound is well mastered. 🌟";
            if (score >= 55) return "Well done! The " + soundLabel + " sound is almost perfect. 👍";
            return "The " + soundLabel + " sound needs more practice. Keep going! 💪";
        }
    }

    private String buildFallbackSynthesis(String lang, List<Map<String, Object>> history, String finalLevel) {
        int avg = (int) history.stream()
                .mapToInt(h -> h.get("score") instanceof Number n ? n.intValue() : 0)
                .average().orElse(50);

        if ("fr".equals(lang)) {
            if (avg >= 75) return "Très bon niveau (" + finalLevel + ") ! Ta prononciation est excellente. Continue ainsi ! 🌟";
            if (avg >= 55) return "Bon niveau général (" + finalLevel + "). Quelques sons méritent plus de pratique pour progresser. 👍";
            return "Des bases solides (" + finalLevel + "). Avec de la pratique régulière, tu vas t'améliorer rapidement. 💪";
        } else {
            if (avg >= 75) return "Very good level (" + finalLevel + ")! Your pronunciation is excellent. Keep it up! 🌟";
            if (avg >= 55) return "Good overall level (" + finalLevel + "). A few sounds need more practice to improve. 👍";
            return "Solid foundations (" + finalLevel + "). With regular practice, you'll improve quickly. 💪";
        }
    }

    private Map<String, Object> buildStepResponse(AgentState state, String lang, String sessionId) {
        int displayStep = state.<Integer>value("display_step").orElse(0);
        return Map.of(
                "session_id",      sessionId,
                "target_sound",    state.<String>value("current_sound").orElse(""),
                "sound_label",     state.<String>value("current_label").orElse(""),
                "estimated_level", state.<String>value("estimated_level").orElse("B1"),
                "phrase",          state.<String>value("current_phrase").orElse(""),
                "instruction",     state.<String>value("current_tip").orElse(""),
                "step",            displayStep + 1,
                "total",           TOTAL_STEPS
        );
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> buildFinishResponse(AgentState state) {
        List<Map<String, Object>> history = state.<List<Map<String, Object>>>value("history").orElse(List.of());
        String finalLevel = state.<String>value("final_level").orElseGet(() -> computeCefr(history));
        int avgScore = history.stream()
                .mapToInt(h -> h.get("score") instanceof Number n ? n.intValue() : 0)
                .sum();
        if (!history.isEmpty()) avgScore /= history.size();

        return Map.of(
                "done", true,
                "final_level", finalLevel,
                "feedback", state.<String>value("synthesis").orElse(""),
                "strengths", state.<List<String>>value("strengths").orElse(List.of()),
                "weaknesses", state.<List<String>>value("weaknesses").orElse(List.of()),
                "history", history,
                "score", avgScore
        );
    }
}
