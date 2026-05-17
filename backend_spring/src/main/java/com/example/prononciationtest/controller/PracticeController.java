package com.example.prononciationtest.controller;

import com.example.prononciationtest.service.iservice.IPracticeService;
import com.example.prononciationtest.service.iservice.IPythonSttClient;
import com.example.prononciationtest.service.iservice.IOllamaService;
import com.example.prononciationtest.service.dto.EvaluationResponse;
import com.example.prononciationtest.service.dto.GenerateRequest;
import com.example.prononciationtest.service.dto.PhraseResponse;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import jakarta.validation.Valid;

import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.springframework.http.HttpStatus.*;

@RestController
@CrossOrigin(origins = "http://localhost:8081")
@RequestMapping("/api/practice")
public class PracticeController {

    private final IPracticeService practiceService;
    private final IOllamaService   ollamaService;
    private final IPythonSttClient pythonSttClient;

    public PracticeController(IPracticeService practiceService,
                               IOllamaService   ollamaService,
                               IPythonSttClient pythonSttClient) {
        this.practiceService = practiceService;
        this.ollamaService   = ollamaService;
        this.pythonSttClient = pythonSttClient;
    }

    // ── Générer une phrase ────────────────────────────────────────────────────
    @PostMapping("/generate")
    public ResponseEntity<PhraseResponse> generatePhrase(@Valid @RequestBody GenerateRequest request) {
        String lang  = request.getLang()  != null ? request.getLang()  : "fr";
        String level = request.getLevel() != null ? request.getLevel() : "B1";

        if (!lang.matches("fr|en"))               return ResponseEntity.badRequest().build();
        if (!level.matches("A1|A2|B1|B2|C1|C2")) return ResponseEntity.badRequest().build();

        String phrase = ollamaService.generatePhrase(lang, level);
        return ResponseEntity.ok(new PhraseResponse(phrase));
    }

    // ── Évaluer la prononciation ──────────────────────────────────────────────
    @PostMapping(
            value    = "/evaluate",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE
    )
    public ResponseEntity<EvaluationResponse> evaluate(
            Authentication authentication,
            @RequestParam("expectedPhrase")                       String      expectedPhrase,
            @RequestParam(value = "lang",  defaultValue = "fr")   String      lang,
            @RequestParam(value = "level", defaultValue = "B1")   String      level,
            @RequestPart("file") MultipartFile file
    ) {
        if (authentication == null || authentication.getName() == null || authentication.getName().isBlank())
            throw new ResponseStatusException(UNAUTHORIZED, "Not authenticated");
        if (file == null || file.isEmpty())
            throw new ResponseStatusException(BAD_REQUEST, "file is required");
        if (expectedPhrase == null || expectedPhrase.isBlank())
            throw new ResponseStatusException(BAD_REQUEST, "expectedPhrase is required");
        if (!lang.matches("fr|en"))
            throw new ResponseStatusException(BAD_REQUEST, "lang must be fr or en");
        if (!level.matches("A1|A2|B1|B2|C1|C2"))
            throw new ResponseStatusException(BAD_REQUEST, "level must be A1/A2/B1/B2/C1/C2");

        EvaluationResponse response = practiceService.evaluate(
                file, expectedPhrase, lang, level, authentication.getName()
        );
        return ResponseEntity.ok(response);
    }

    // ── Feedback prononciation (endpoint direct) ──────────────────────────────
    @PostMapping("/feedback/generate")
    public ResponseEntity<Map<String, String>> generateFeedback(
            @RequestBody Map<String, Object> req
    ) {
        String lang           = (String) req.getOrDefault("lang",           "fr");
        String level          = (String) req.getOrDefault("level",          "B1");
        String expectedPhrase = (String) req.getOrDefault("expectedPhrase", "");
        String transcript     = (String) req.getOrDefault("transcript",     "");
        int    score          = req.containsKey("score") ? ((Number) req.get("score")).intValue() : 0;

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> ops = req.containsKey("ops")
                ? (List<Map<String, Object>>) req.get("ops")
                : Collections.emptyList();

        boolean suspectedHallucination = Boolean.TRUE.equals(req.get("suspected_hallucination"));
        int nExpected = req.containsKey("n_expected") ? ((Number) req.get("n_expected")).intValue() : 0;
        int nMatch    = req.containsKey("n_match")    ? ((Number) req.get("n_match")).intValue()    : 0;

        Map<String, Object> scoreResult = new java.util.LinkedHashMap<>();
        scoreResult.put("score", score);
        scoreResult.put("ops", ops);
        scoreResult.put("suspected_hallucination", suspectedHallucination);
        scoreResult.put("n_expected", nExpected);
        scoreResult.put("n_match",    nMatch);

        String feedback = ollamaService.generateFeedback(
                expectedPhrase, transcript, transcript,
                Collections.emptyList(), scoreResult, lang, level
        );
        return ResponseEntity.ok(Map.of("feedback", feedback));
    }

    // ── Health check ──────────────────────────────────────────────────────────
    @GetMapping(value = "/health", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> health() {
        boolean whisperOk = pythonSttClient.isHealthy();
        boolean ollamaOk  = ollamaService.isHealthy();

        boolean allOk = whisperOk && ollamaOk;
        Map<String, Object> status = Map.of(
                "whisper_python", whisperOk ? "UP"   : "DOWN",
                "ollama",         ollamaOk  ? "UP"   : "DOWN",
                "overall",        allOk ? "OK" : "DEGRADED"
        );
        return allOk
                ? ResponseEntity.ok(status)
                : ResponseEntity.status(503).body(status);
    }
}
