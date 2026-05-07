package com.example.prononciationtest.controller;

import com.example.prononciationtest.service.OllamaService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/reports")
@CrossOrigin(origins = "http://localhost:8081")
public class ReportsController {

    private final OllamaService ollamaService;
    private final ObjectMapper  objectMapper;

    public ReportsController(OllamaService ollamaService, ObjectMapper objectMapper) {
        this.ollamaService = ollamaService;
        this.objectMapper  = objectMapper;
    }

    @PostMapping("/analyze")
    public ResponseEntity<Map<String, Object>> analyze(
            @RequestBody Map<String, Object> req) {

        String lang  = (String) req.getOrDefault("lang",  "fr");
        String level = (String) req.getOrDefault("level", "B1");

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> sessions = (List<Map<String, Object>>) req.getOrDefault("sessions", List.of());

        List<Integer> scores = sessions.stream()
                .map(s -> s.get("score"))
                .filter(Objects::nonNull)
                .map(v -> ((Number) v).intValue())
                .filter(s -> s > 0)
                .toList();

        if (scores.isEmpty()) {
            int avg = 0, best = 0;
            return ResponseEntity.ok(Map.of(
                "avg_score", avg, "best_score", best,
                "trend", "Stable",
                "tips", List.of(
                    "fr".equals(lang) ? "Commence par compléter quelques exercices pour obtenir une analyse personnalisée."
                                      : "Complete some exercises first to get a personalized analysis."
                )
            ));
        }

        try {
            String raw = ollamaService.generateReportsAnalysis(lang, level, scores);
            if (raw == null || raw.isBlank()) throw new Exception("empty response");

            // Extract JSON object from response (model may wrap it in text)
            int start = raw.indexOf('{');
            int end   = raw.lastIndexOf('}');
            if (start < 0 || end < 0) throw new Exception("no JSON in response");
            String json = raw.substring(start, end + 1);

            @SuppressWarnings("unchecked")
            Map<String, Object> result = objectMapper.readValue(json, Map.class);
            return ResponseEntity.ok(result);

        } catch (Exception e) {
            int avg  = (int) Math.round(scores.stream().mapToInt(i -> i).average().orElse(0));
            int best = scores.stream().mapToInt(i -> i).max().orElse(0);
            int last5avg = scores.size() >= 2
                    ? (int) Math.round(scores.subList(Math.max(0, scores.size() - 5), scores.size())
                            .stream().mapToInt(i -> i).average().orElse(avg))
                    : avg;
            String trend = last5avg > avg + 3
                    ? ("fr".equals(lang) ? "En progression" : "Improving")
                    : last5avg < avg - 3
                    ? ("fr".equals(lang) ? "En baisse" : "Declining")
                    : "Stable";
            List<String> tips = "fr".equals(lang)
                    ? List.of(
                        "Pratique régulièrement pour ancrer tes automatismes.",
                        "Concentre-toi sur les sons qui te posent problème.",
                        "Enregistre-toi et compare ta prononciation à celle d'un locuteur natif."
                      )
                    : List.of(
                        "Practice regularly to build solid habits.",
                        "Focus on the sounds that challenge you the most.",
                        "Record yourself and compare to a native speaker."
                      );
            return ResponseEntity.ok(Map.of(
                "avg_score", avg, "best_score", best, "trend", trend, "tips", tips
            ));
        }
    }
}
