package com.example.prononciationtest.service;

import com.example.prononciationtest.entity.Attempt;
import com.example.prononciationtest.entity.User;
import com.example.prononciationtest.repository.AttemptRepository;
import com.example.prononciationtest.repository.UserRepository;
import com.example.prononciationtest.service.dto.EvaluationResponse;
import com.example.prononciationtest.service.dto.PythonAnalyzeClient;
import com.example.prononciationtest.service.dto.PythonAnalyzeResponse;
import com.example.prononciationtest.service.iservice.IOllamaService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PracticeServiceTest {

    @Mock PythonAnalyzeClient pythonAnalyzeClient;
    @Mock IOllamaService      ollamaService;
    @Mock AttemptRepository   attemptRepository;
    @Mock UserRepository      userRepository;

    @InjectMocks PracticeService practiceService;

    // ── 1. Unit Tests for Pure & Static Methods ──────────────────────────────

    @Test
    void computeScore_combinations() {
        // perfect case
        assertThat(PracticeService.computeScore(50, 30.0, 0.70)).isEqualTo(100);
        // low confidence floor
        assertThat(PracticeService.computeScore(5, 5.0, 0.10)).isEqualTo(8);
        // zero confidence floor
        assertThat(PracticeService.computeScore(0, 0.0, 0.0)).isEqualTo(0);
        // raw capped to 100
        assertThat(PracticeService.computeScore(100, 100.0, 1.0)).isEqualTo(100);
    }

    @Test
    void computeCefrScore_levels() {
        // level A1 (multiplier 1.15)
        assertThat(PracticeService.computeCefrScore(80, 0.8, 5, "A1")).isEqualTo(87);
        // level A2 (multiplier 1.10)
        assertThat(PracticeService.computeCefrScore(80, 0.8, 5, "A2")).isEqualTo(83);
        // level B1 (multiplier 1.05)
        assertThat(PracticeService.computeCefrScore(80, 0.8, 5, "B1")).isEqualTo(79);
        // level B2 (multiplier 1.00)
        assertThat(PracticeService.computeCefrScore(80, 0.8, 5, "B2")).isEqualTo(75);
        // level C1 (multiplier 0.95)
        assertThat(PracticeService.computeCefrScore(80, 0.8, 5, "C1")).isEqualTo(71);
        // level C2 (multiplier 0.90)
        assertThat(PracticeService.computeCefrScore(80, 0.8, 5, "C2")).isEqualTo(67);
        // default / invalid level
        assertThat(PracticeService.computeCefrScore(80, 0.8, 5, "XX")).isEqualTo(75);
    }

    @Test
    void computePhoneticPenalty_combinations() {
        // null list
        assertThat(PracticeService.computePhoneticPenalty(null)).isEqualTo(0);
        // empty list
        assertThat(PracticeService.computePhoneticPenalty(List.of())).isEqualTo(0);

        // list with weak words (probability < 0.45)
        Map<String, Object> w1 = Map.of("word", "hello", "probability", 0.30);
        Map<String, Object> w2 = Map.of("word", "world", "probability", 0.80);
        Map<String, Object> w3 = Map.of("word", "test", "probability", 0.20);
        assertThat(PracticeService.computePhoneticPenalty(List.of(w1, w2, w3))).isEqualTo(4);

        // list with many weak words (capped to 8)
        List<Map<String, Object>> many = new ArrayList<>();
        for (int i = 0; i < 10; i++) {
            many.add(Map.of("word", "w", "probability", 0.10));
        }
        assertThat(PracticeService.computePhoneticPenalty(many)).isEqualTo(8);
    }

    @Test
    void xpForScore_ranges() {
        assertThat(PracticeService.xpForScore(95)).isEqualTo(20);
        assertThat(PracticeService.xpForScore(80)).isEqualTo(15);
        assertThat(PracticeService.xpForScore(65)).isEqualTo(10);
        assertThat(PracticeService.xpForScore(50)).isEqualTo(7);
        assertThat(PracticeService.xpForScore(35)).isEqualTo(4);
        assertThat(PracticeService.xpForScore(20)).isEqualTo(2);
    }

    @Test
    void scoreLabel_fr_en() {
        assertThat(PracticeService.scoreLabel(95, "fr")).contains("Excellent");
        assertThat(PracticeService.scoreLabel(95, "en")).contains("Excellent");
        assertThat(PracticeService.scoreLabel(85, "fr")).contains("Très bien");
        assertThat(PracticeService.scoreLabel(85, "en")).contains("Very good");
        assertThat(PracticeService.scoreLabel(70, "fr")).contains("Bien");
        assertThat(PracticeService.scoreLabel(70, "en")).contains("Good");
        assertThat(PracticeService.scoreLabel(55, "fr")).contains("Passable");
        assertThat(PracticeService.scoreLabel(55, "en")).contains("Fair");
        assertThat(PracticeService.scoreLabel(20, "fr")).contains("retravailler");
        assertThat(PracticeService.scoreLabel(20, "en")).contains("work");
    }

    @Test
    void fallbackFeedback_fr_en() {
        assertThat(PracticeService.fallbackFeedback(80, "fr")).contains("Excellente prononciation");
        assertThat(PracticeService.fallbackFeedback(80, "en")).contains("Excellent pronunciation");
        assertThat(PracticeService.fallbackFeedback(60, "fr")).contains("Bonne tentative");
        assertThat(PracticeService.fallbackFeedback(60, "en")).contains("Good attempt");
        assertThat(PracticeService.fallbackFeedback(30, "fr")).contains("Reprends la phrase");
        assertThat(PracticeService.fallbackFeedback(30, "en")).contains("Break the phrase");
    }

    @Test
    void sttMessage_codes() {
        assertThat(PracticeService.sttMessage("SILENT_AUDIO")).contains("silencieux");
        assertThat(PracticeService.sttMessage("NO_SPEECH_DETECTED")).contains("Aucune parole");
        assertThat(PracticeService.sttMessage("HALLUCINATION_DETECTED")).contains("invalide");
        assertThat(PracticeService.sttMessage("LOW_CONFIDENCE")).contains("faible");
        assertThat(PracticeService.sttMessage("SOME_RANDOM_CODE")).contains("inconnue");
    }

    // ── 2. Flow Tests for evaluate() ─────────────────────────────────────────

    @Test
    void evaluate_whenSttError_returnsSttErrorResponse() {
        MultipartFile file = new MockMultipartFile("file", "test.wav", "audio/wav", "data".getBytes());
        PythonAnalyzeResponse mockPy = new PythonAnalyzeResponse();
        mockPy.setSttError(true);
        mockPy.setSttErrorCode("SILENT_AUDIO");

        when(pythonAnalyzeClient.analyze(any(), anyString(), anyString(), anyString())).thenReturn(mockPy);

        EvaluationResponse response = practiceService.evaluate(file, "expected", "fr", "A1", "alice");

        assertThat(response.isSttError()).isTrue();
        assertThat(response.getSttErrorCode()).isEqualTo("SILENT_AUDIO");
        assertThat(response.getSttErrorMessage()).contains("silencieux");
        verify(attemptRepository, never()).save(any());
    }

    @Test
    void evaluate_successfulFlow() {
        MultipartFile file = new MockMultipartFile("file", "test.wav", "audio/wav", "data".getBytes());

        PythonAnalyzeResponse mockPy = new PythonAnalyzeResponse();
        mockPy.setSttError(false);
        mockPy.setCleanTranscript("bonjour tout le monde");
        mockPy.setRawTranscript("bonjour tout le monde");
        mockPy.setAvgConfidence(0.85);
        mockPy.setF1(90.0);
        mockPy.setWordDiffScore(85);
        mockPy.setWer(0.1);
        mockPy.setPrecision(0.9);
        mockPy.setRecall(0.9);
        mockPy.setFillersFound(List.of("euh"));

        PythonAnalyzeResponse.Op op = new PythonAnalyzeResponse.Op();
        op.setOp("MATCH");
        op.setExpected("bonjour");
        op.setGot("bonjour");
        mockPy.setOps(List.of(op));

        User mockUser = new User();
        mockUser.setId(10L);
        mockUser.setEmail("alice");

        when(pythonAnalyzeClient.analyze(any(), anyString(), anyString(), anyString())).thenReturn(mockPy);
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(mockUser));
        when(ollamaService.generateFeedback(anyString(), anyString(), anyString(), any(), anyMap(), anyString(), anyString()))
                .thenReturn("Superbe travail !");

        EvaluationResponse response = practiceService.evaluate(file, "bonjour", "fr", "A1", "alice");

        assertThat(response.isSttError()).isFalse();
        assertThat(response.getScore()).isGreaterThan(0);
        assertThat(response.getFeedback()).isEqualTo("Superbe travail !");
        assertThat(response.getNMatch()).isEqualTo(1);

        verify(attemptRepository, times(1)).save(any(Attempt.class));
    }

    @Test
    void evaluate_whenOllamaServiceThrowsException_usesFallbackFeedback() {
        MultipartFile file = new MockMultipartFile("file", "test.wav", "audio/wav", "data".getBytes());

        PythonAnalyzeResponse mockPy = new PythonAnalyzeResponse();
        mockPy.setSttError(false);
        mockPy.setCleanTranscript("bonjour");
        mockPy.setAvgConfidence(0.80);
        mockPy.setF1(80.0);
        mockPy.setWordDiffScore(80);

        User mockUser = new User();
        mockUser.setId(10L);
        mockUser.setEmail("alice");

        when(pythonAnalyzeClient.analyze(any(), anyString(), anyString(), anyString())).thenReturn(mockPy);
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(mockUser));
        when(ollamaService.generateFeedback(anyString(), anyString(), anyString(), any(), anyMap(), anyString(), anyString()))
                .thenThrow(new RuntimeException("Ollama offline"));

        EvaluationResponse response = practiceService.evaluate(file, "bonjour", "fr", "A1", "alice");

        assertThat(response.isSttError()).isFalse();
        assertThat(response.getFeedback()).contains("Excellente prononciation"); // Fallback check
        verify(attemptRepository, times(1)).save(any(Attempt.class));
    }
}
