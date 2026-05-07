package com.example.prononciationtest.controller;

import com.example.prononciationtest.service.OllamaService;
import com.example.prononciationtest.service.PhraseTaxonomy;
import com.example.prononciationtest.service.dto.PythonAnalyzeClient;
import com.example.prononciationtest.service.dto.PythonAnalyzeResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * Endpoints pour la génération d'exercices IA via Ollama (Spring Boot).
 * FastAPI gère uniquement Whisper STT + scoring + feedback phonétique.
 */
@RestController
@RequestMapping("/api/exercises")
@RequiredArgsConstructor
public class ExerciseAiController {

    private static final Logger log = LoggerFactory.getLogger(ExerciseAiController.class);

    private final OllamaService      ollamaService;
    private final PhraseTaxonomy     taxonomy;
    private final ObjectMapper       objectMapper;
    private final PythonAnalyzeClient pythonAnalyzeClient;

    // Cache: key = "lang_level_count", value = [phrases list, timestamp ms]
    private static final long CACHE_TTL_MS = 30 * 60 * 1000L; // 30 minutes
    private final ConcurrentHashMap<String, Object[]> phrasesCache = new ConcurrentHashMap<>();

    // ── Génération d'exercices ────────────────────────────────────────────────
    @PostMapping("/generate")
    public ResponseEntity<?> generateExercises(
            @RequestBody Map<String, Object> req) {

        String lang   = (String) req.getOrDefault("lang",  "fr");
        String level  = (String) req.getOrDefault("level", "B1");
        String type   = (String) req.getOrDefault("type",  "grammar");
        int    count  = req.containsKey("count") ? ((Number) req.get("count")).intValue() : 5;

        // ── Phrase generation for revision / phonetic tabs (frontend expects { phrase: "..." })
        if ("revision".equals(type) || "phonetic".equals(type)) {
            String prompt = (String) req.getOrDefault("prompt", "");
            String phrase = null;
            if (!prompt.isBlank()) {
                try {
                    String system = "fr".equals(lang)
                            ? "Tu es un coach de prononciation française. Réponds UNIQUEMENT avec la phrase demandée, rien d'autre."
                            : "You are an English pronunciation coach. Reply ONLY with the requested sentence, nothing else.";
                    phrase = ollamaService.callRaw(system, prompt, 60, 0.75, lang);
                } catch (Exception e) {
                    log.warn("[ExerciseAi] Ollama phrase generation failed, using fallback: {}", e.getMessage());
                }
            }
            if (phrase == null || taxonomy.isHallucination(phrase, lang)) {
                phrase = taxonomy.getFallback(lang, level, "revision");
            }
            return ResponseEntity.ok(Map.of("phrase", phrase, "lang", lang, "level", level));
        }

        String raw = ollamaService.generateExercises(lang, level, type, count);

        try {
            List<?> exercises = objectMapper.readValue(parseJsonArray(raw), List.class);
            // Ajouter le champ "type" à chaque exercice
            List<Map<String, Object>> result = exercises.stream()
                .map(e -> {
                    try {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> map = (Map<String, Object>) e;
                        map.put("type", type);
                        return map;
                    } catch (Exception ex) { return Map.<String,Object>of("type", type); }
                })
                .collect(Collectors.toList());
            return ResponseEntity.ok(Map.of("exercises", result, "level", level, "lang", lang, "type", type));
        } catch (Exception e) {
            // Fallback minimal si Ollama renvoie un JSON malformé
            return ResponseEntity.ok(Map.of(
                "exercises", List.of(),
                "level", level, "lang", lang, "type", type,
                "error", "Génération indisponible : " + e.getMessage()
            ));
        }
    }

    // ── Feedback après une session d'exercices ────────────────────────────────
    @PostMapping("/feedback")
    public ResponseEntity<?> exerciseFeedback(
            @RequestBody Map<String, Object> req) {

        String lang  = (String) req.getOrDefault("lang",  "fr");
        String level = (String) req.getOrDefault("level", "B1");
        String type  = (String) req.getOrDefault("type",  "grammar");
        int    score = req.containsKey("score") ? ((Number) req.get("score")).intValue() : 0;

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> summary = (List<Map<String, Object>>) req.getOrDefault("summary", List.of());

        int correct = (int) summary.stream().filter(s -> Boolean.TRUE.equals(s.get("isCorrect"))).count();
        int total   = summary.size();

        String errorsDetail = summary.stream()
            .filter(s -> !Boolean.TRUE.equals(s.get("isCorrect")))
            .limit(5)
            .map(s -> String.format("'%s' → correct: '%s'",
                s.getOrDefault("question", s.getOrDefault("phrase", "")),
                s.getOrDefault("correct", "")))
            .collect(Collectors.joining(", "));

        String feedback = ollamaService.generateExerciseFeedback(lang, level, type, score, correct, total, errorsDetail);
        return ResponseEntity.ok(Map.of("feedback", feedback));
    }

    // ── Génération d'exercices via GET (par niveau) ───────────────────────────
    @GetMapping("/generate")
    public ResponseEntity<?> generateExercisesGet(
            @RequestParam(defaultValue = "fr")      String lang,
            @RequestParam(defaultValue = "B1")      String level,
            @RequestParam(defaultValue = "grammar") String type,
            @RequestParam(defaultValue = "5")       int    count) {

        return generateExercises(Map.of(
            "lang", lang, "level", level, "type", type, "count", count
        ));
    }

    // ── Phrases pour la pratique orale ───────────────────────────────────────
    @GetMapping("/phrases/{level}")
    public ResponseEntity<?> getExercisePhrases(
            @PathVariable String level,
            @RequestParam(defaultValue = "fr") String lang,
            @RequestParam(defaultValue = "10") int count) {

        String cacheKey = lang + "_" + level + "_" + count;
        Object[] cached = phrasesCache.get(cacheKey);
        if (cached != null && (System.currentTimeMillis() - (long) cached[1]) < CACHE_TTL_MS) {
            return ResponseEntity.ok(Map.of("phrases", cached[0], "cached", true));
        }

        String raw = ollamaService.generateExercisePhrases(lang, level, count);
        try {
            List<?> phrases = objectMapper.readValue(parseJsonArray(raw), List.class);
            if (!phrases.isEmpty()) {
                phrasesCache.put(cacheKey, new Object[]{ phrases, System.currentTimeMillis() });
            }
            return ResponseEntity.ok(Map.of("phrases", phrases));
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("phrases", List.of()));
        }
    }

    // ── Vider le cache (admin) ────────────────────────────────────────────────
    @DeleteMapping("/phrases/cache")
    public ResponseEntity<?> clearPhrasesCache() {
        phrasesCache.clear();
        return ResponseEntity.ok(Map.of("cleared", true));
    }

    // ── Analyze pronunciation for revision exercises ──────────────────────────
    @PostMapping(value = "/analyze", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> analyzeRevision(
            @RequestPart("file")                                     MultipartFile file,
            @RequestParam("expectedPhrase")                          String        expectedPhrase,
            @RequestParam(value = "lang",      defaultValue = "fr")  String        lang,
            @RequestParam(value = "level",     defaultValue = "B1")  String        level,
            @RequestParam(value = "job_title", defaultValue = "")    String        jobTitle
    ) {
        try {
            PythonAnalyzeResponse py = pythonAnalyzeClient.analyze(file, expectedPhrase, lang, level);

            if (py == null || Boolean.TRUE.equals(py.getSttError())) {
                boolean fr = "fr".equals(lang);
                return ResponseEntity.ok(Map.of(
                    "score", 0,
                    "feedback", fr ? "Audio non détecté — réessaie." : "Audio not detected — try again.",
                    "transcript", "", "stt_error", true
                ));
            }

            int wordDiff = py.getWordDiffScore() != null ? py.getWordDiffScore() : 0;
            double f1    = py.getF1()            != null ? py.getF1()            : 0.0;
            double conf  = py.getAvgConfidence() != null ? py.getAvgConfidence() : 1.0;
            int score    = (int) Math.max(0, Math.min(100, Math.round(0.50 * wordDiff + 0.30 * f1 * 100 + 0.20 * conf * 100)));

            String feedback;
            try {
                Map<String, Object> scoreResult = new LinkedHashMap<>();
                scoreResult.put("score", score);
                scoreResult.put("ops",     py.getOps()    != null ? py.getOps()    : List.of());
                scoreResult.put("n_match", py.getNMatch() != null ? py.getNMatch() : 0);
                scoreResult.put("suspected_hallucination", false);
                feedback = ollamaService.generateFeedback(
                        expectedPhrase, py.getTranscript() != null ? py.getTranscript() : "",
                        py.getTranscript() != null ? py.getTranscript() : "",
                        List.of(), scoreResult, lang, level);
                if (feedback == null || feedback.isBlank()) feedback = fallbackFeedback(score, lang);
            } catch (Exception e) {
                feedback = fallbackFeedback(score, lang);
            }

            Map<String, Object> resp = new LinkedHashMap<>();
            resp.put("score",      score);
            resp.put("feedback",   feedback);
            resp.put("transcript", py.getTranscript() != null ? py.getTranscript() : "");
            resp.put("wer",        py.getWer()        != null ? py.getWer()        : 1.0);
            resp.put("stt_error",  false);
            return ResponseEntity.ok(resp);

        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of(
                "error",    e.getMessage(),
                "score",    0,
                "feedback", "fr".equals(lang) ? "Erreur serveur — réessaie." : "Server error — try again."
            ));
        }
    }

    private static String fallbackFeedback(int score, String lang) {
        boolean fr = "fr".equals(lang);
        if (score >= 75) return fr ? "Excellente prononciation ! Continue comme ça." : "Excellent pronunciation! Keep it up.";
        if (score >= 50) return fr ? "Bonne tentative. Répète les mots difficiles lentement." : "Good attempt. Repeat the difficult words slowly.";
        return fr ? "Continue à pratiquer ces mots. Tu t'amélioreras !" : "Keep practicing these words. You'll improve!";
    }

    // ── Helper : extrait un tableau JSON depuis la réponse brute ─────────────
    private String parseJsonArray(String raw) {
        if (raw == null || raw.isBlank()) return "[]";
        // Enlever les backticks markdown
        String clean = raw.replaceAll("```(?:json)?", "").replace("```", "").trim();
        int start = clean.indexOf('[');
        int end   = clean.lastIndexOf(']');
        if (start >= 0 && end > start) return clean.substring(start, end + 1);
        return "[]";
    }
}
