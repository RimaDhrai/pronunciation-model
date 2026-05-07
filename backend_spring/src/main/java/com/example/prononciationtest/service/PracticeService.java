package com.example.prononciationtest.service;

import com.example.prononciationtest.service.iservice.IPracticeService;
import com.example.prononciationtest.service.iservice.IOllamaService;
import com.example.prononciationtest.entity.Attempt;
import com.example.prononciationtest.entity.User;
import com.example.prononciationtest.repository.AttemptRepository;
import com.example.prononciationtest.repository.UserRepository;
import com.example.prononciationtest.service.dto.EvaluationResponse;
import com.example.prononciationtest.service.dto.PythonAnalyzeClient;
import com.example.prononciationtest.service.dto.PythonAnalyzeResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.*;

@Service
public class PracticeService implements IPracticeService {

    private static final Logger log = LoggerFactory.getLogger(PracticeService.class);

    private final PythonAnalyzeClient pythonAnalyzeClient;
    private final IOllamaService      ollamaService;
    private final AttemptRepository   attemptRepository;
    private final UserRepository      userRepository;

    public PracticeService(PythonAnalyzeClient pythonAnalyzeClient,
                           IOllamaService      ollamaService,
                           AttemptRepository   attemptRepository,
                           UserRepository      userRepository) {
        this.pythonAnalyzeClient = pythonAnalyzeClient;
        this.ollamaService       = ollamaService;
        this.attemptRepository   = attemptRepository;
        this.userRepository      = userRepository;
    }

    // ── Public API ────────────────────────────────────────────────────────────

    @Override
    public EvaluationResponse evaluate(MultipartFile audioFile,
                                       String expectedPhrase,
                                       String lang,
                                       String level,
                                       String username) {

        PythonAnalyzeResponse py = pythonAnalyzeClient.analyze(audioFile, expectedPhrase, lang, level);

        if (py.hasSttError()) {
            EvaluationResponse r = new EvaluationResponse();
            r.setSttError(true);
            r.setSttErrorCode(py.getSttErrorCode() != null ? py.getSttErrorCode() : "UNKNOWN");
            r.setSttErrorMessage(sttMessage(r.getSttErrorCode()));
            return r;
        }

        String clean   = py.getCleanTranscript() != null ? py.getCleanTranscript()
                       : py.getTranscript() != null       ? py.getTranscript() : "";
        String raw     = py.getRawTranscript()   != null ? py.getRawTranscript() : clean;

        double avgConf     = py.getAvgConfidence() != null ? py.getAvgConfidence() : 0.0;
        int    phonPenalty = computePhoneticPenalty(py.getWords());
        int    score       = computeScore(py.getWordDiffScore(), py.getF1(), avgConf);
        int    cefrScore   = computeCefrScore(score, avgConf, phonPenalty, level);
        int    xp          = xpForScore(score);

        String feedback;
        try {
            Map<String, Object> scoreResult = new LinkedHashMap<>();
            scoreResult.put("score", score);
            List<Map<String, Object>> ops = new ArrayList<>();
            if (py.getOps() != null) {
                for (PythonAnalyzeResponse.Op op : py.getOps()) {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("op",       op.getOp());
                    m.put("expected", op.getExpected());
                    m.put("got",      op.getGot());
                    ops.add(m);
                }
            }
            scoreResult.put("ops", ops);

            feedback = ollamaService.generateFeedback(
                    expectedPhrase, raw, clean,
                    py.getFillersFound() != null ? py.getFillersFound() : List.of(),
                    scoreResult, lang, level
            );
            if (feedback == null || feedback.isBlank()) feedback = fallbackFeedback(score, lang);
        } catch (Exception e) {
            log.warn("[PracticeService] Feedback Ollama échoué: {}", e.getMessage());
            feedback = fallbackFeedback(score, lang);
        }

        EvaluationResponse r = new EvaluationResponse();
        r.setExpectedPhrase(expectedPhrase);
        r.setRawTranscription(raw);
        r.setCleanTranscription(clean);
        r.setFillersFound(py.getFillersFound());
        r.setScore(score);
        r.setCefrScore(cefrScore);
        r.setXpEarned(xp);
        r.setScoreLabel(scoreLabel(score, lang));
        r.setPhoneticPenalty(phonPenalty);
        r.setWer(py.getWer()       != null ? py.getWer()       : 1.0);
        r.setF1(py.getF1()         != null ? py.getF1()        : 0.0);
        r.setPrecision(py.getPrecision() != null ? py.getPrecision() : 0.0);
        r.setRecall(py.getRecall()   != null ? py.getRecall()   : 0.0);
        r.setAvgConfidence(avgConf);
        r.setFeedback(feedback);
        r.setSttError(false);

        if (py.getOps() != null) {
            List<Map<String, Object>> ops = new ArrayList<>();
            int nMatch = 0, nSub = 0, nDel = 0, nIns = 0;
            for (PythonAnalyzeResponse.Op op : py.getOps()) {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("op",       op.getOp());
                m.put("expected", op.getExpected());
                m.put("got",      op.getGot());
                ops.add(m);
                if (op.getOp() == null) continue;
                switch (op.getOp()) {
                    case "MATCH" -> nMatch++;
                    case "SUB"   -> nSub++;
                    case "DEL"   -> nDel++;
                    case "INS"   -> nIns++;
                }
            }
            r.setDiffOps(ops);
            r.setNMatch(nMatch);
            r.setNSub(nSub);
            r.setNDel(nDel);
            r.setNIns(nIns);
        }

        saveAttempt(username, expectedPhrase, py, score, feedback, lang, level);
        return r;
    }

    // ── Score computation (ported from Python config.py) ─────────────────────

    /**
     * Composite score: 50% weighted-match, 30% F1, 20% Whisper confidence.
     */
    static int computeScore(Integer wordDiffScore, Double f1, double avgConf) {
        double wds   = wordDiffScore != null ? wordDiffScore : 0;
        double f1s   = f1           != null ? f1            : 0.0;
        double confS = Math.min(100.0, (avgConf / 0.70) * 100);
        int raw = (int)(wds * 0.50 + f1s * 0.30 + confS * 0.20);
        if (avgConf > 0 && raw < 5) raw = 5;
        return Math.max(0, Math.min(100, raw));
    }

    /**
     * CEFR-adjusted score with phonetic penalty.
     */
    static int computeCefrScore(int raw, double avgConf, int phonPenalty, String level) {
        double tol = switch (level) {
            case "A1" -> 1.15;
            case "A2" -> 1.10;
            case "B1" -> 1.05;
            case "B2" -> 1.0;
            case "C1" -> 0.95;
            case "C2" -> 0.90;
            default   -> 1.0;
        };
        int normalized = (int)(raw * tol);
        normalized = Math.max(0, Math.min(100, normalized));
        int floor = avgConf > 0 ? 5 : 0;
        return Math.max(floor, normalized - phonPenalty);
    }

    /**
     * Count words with Whisper confidence below 0.45 — capped penalty = min(8, count×2).
     */
    @SuppressWarnings("unchecked")
    static int computePhoneticPenalty(List<Map<String, Object>> words) {
        if (words == null || words.isEmpty()) return 0;
        long weak = words.stream().filter(w -> {
            Object prob = w.get("probability");
            return prob instanceof Number && ((Number) prob).doubleValue() < 0.45;
        }).count();
        return (int) Math.min(8, weak * 2);
    }

    static int xpForScore(int score) {
        if (score >= 90) return 20;
        if (score >= 75) return 15;
        if (score >= 60) return 10;
        if (score >= 45) return 7;
        if (score >= 30) return 4;
        return 2;
    }

    static String scoreLabel(int score, String lang) {
        boolean fr = "fr".equals(lang);
        if (score >= 90) return fr ? "Excellent ! Prononciation quasi-parfaite." : "Excellent! Near-perfect.";
        if (score >= 80) return fr ? "Très bien !"                               : "Very good!";
        if (score >= 65) return fr ? "Bien ! Continue."                          : "Good! Keep going.";
        if (score >= 50) return fr ? "Passable."                                 : "Fair. Focus on errors.";
        return                  fr ? "À retravailler."                           : "Needs work.";
    }

    static String fallbackFeedback(int score, String lang) {
        boolean fr = "fr".equals(lang);
        if (score >= 75) return fr ? "Excellente prononciation ! Continue comme ça." : "Excellent pronunciation! Keep it up.";
        if (score >= 50) return fr ? "Bonne tentative. Répète les mots difficiles lentement." : "Good attempt. Repeat the difficult words slowly.";
        return                  fr ? "Reprends la phrase syllabe par syllabe et articule bien." : "Break the phrase into syllables and articulate clearly.";
    }

    static String sttMessage(String code) {
        return switch (code) {
            case "SILENT_AUDIO"           -> "Audio trop silencieux, parle plus fort.";
            case "NO_SPEECH_DETECTED"     -> "Aucune parole détectée.";
            case "HALLUCINATION_DETECTED" -> "Transcription invalide, réessaie.";
            case "LOW_CONFIDENCE"         -> "Confiance trop faible, parle plus clairement.";
            default                       -> "Erreur de transcription inconnue.";
        };
    }

    // ── Persistence ───────────────────────────────────────────────────────────

    private void saveAttempt(String username, String expectedPhrase,
                             PythonAnalyzeResponse py, int score, String feedback,
                             String lang, String level) {
        Optional<User> userOpt = userRepository.findByUsername(username);
        if (userOpt.isEmpty()) userOpt = userRepository.findByEmail(username);
        if (userOpt.isEmpty()) return;

        Attempt a = new Attempt();
        a.setUser(userOpt.get());
        a.setExpectedPhrase(expectedPhrase);
        a.setTranscription(py.getTranscript());
        a.setScore(score);
        a.setWer(py.getWer() != null ? py.getWer() : 1.0);
        a.setFeedback(feedback);
        a.setLanguage(lang);
        a.setLevel(level);
        a.setCreatedAt(LocalDateTime.now());

        attemptRepository.save(a);
    }
}
