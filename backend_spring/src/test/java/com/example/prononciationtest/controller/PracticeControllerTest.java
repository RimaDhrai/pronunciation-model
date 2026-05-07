package com.example.prononciationtest.controller;

import com.example.prononciationtest.config.TestSecurityConfig;
import com.example.prononciationtest.service.iservice.IOllamaService;
import com.example.prononciationtest.service.iservice.IPracticeService;
import com.example.prononciationtest.service.iservice.IPythonSttClient;
import com.example.prononciationtest.service.dto.EvaluationResponse;
import com.example.prononciationtest.service.dto.GenerateRequest;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(PracticeController.class)
@Import(TestSecurityConfig.class)
class PracticeControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;

    @MockBean IPracticeService     practiceService;
    @MockBean IOllamaService       ollamaService;
    @MockBean IPythonSttClient     pythonSttClient;
    // ── generatePhrase ────────────────────────────────────────────────────────

    @Test
    void generatePhrase_validRequest_returns200() throws Exception {
        when(ollamaService.generatePhrase("fr", "B1"))
                .thenReturn("Le chat boit du lait");

        GenerateRequest req = new GenerateRequest();
        req.setLang("fr");
        req.setLevel("B1");

        mockMvc.perform(post("/api/practice/generate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.phrase").value("Le chat boit du lait"));
    }

    @Test
    void generatePhrase_invalidLang_returns400() throws Exception {
        GenerateRequest req = new GenerateRequest();
        req.setLang("xx");
        req.setLevel("B1");

        mockMvc.perform(post("/api/practice/generate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void generatePhrase_invalidLevel_returns400() throws Exception {
        GenerateRequest req = new GenerateRequest();
        req.setLang("fr");
        req.setLevel("Z9");

        mockMvc.perform(post("/api/practice/generate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isBadRequest());
    }

    // ── evaluate ──────────────────────────────────────────────────────────────

    @Test
    @WithMockUser(username = "alice@test.com")
    void evaluate_validRequest_returns200() throws Exception {
        EvaluationResponse eval = new EvaluationResponse();
        eval.setScore(85);
        eval.setFeedback("Bien joué !");
        when(practiceService.evaluate(any(), eq("bonjour"), eq("fr"), eq("B1"), eq("alice@test.com")))
                .thenReturn(eval);

        MockMultipartFile file = new MockMultipartFile(
                "file", "audio.webm", "audio/webm", "data".getBytes());

        mockMvc.perform(multipart("/api/practice/evaluate")
                        .file(file)
                        .param("expectedPhrase", "bonjour")
                        .param("lang", "fr")
                        .param("level", "B1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.score").value(85))
                .andExpect(jsonPath("$.feedback").value("Bien joué !"));
    }

    @Test
    void evaluate_unauthenticated_returns401() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file", "audio.webm", "audio/webm", "data".getBytes());

        mockMvc.perform(multipart("/api/practice/evaluate")
                        .file(file)
                        .param("expectedPhrase", "bonjour")
                        .param("lang", "fr")
                        .param("level", "B1"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(username = "alice@test.com")
    void evaluate_emptyFile_returns400() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file", "audio.webm", "audio/webm", new byte[0]);

        mockMvc.perform(multipart("/api/practice/evaluate")
                        .file(file)
                        .param("expectedPhrase", "bonjour")
                        .param("lang", "fr")
                        .param("level", "B1"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(username = "alice@test.com")
    void evaluate_invalidLang_returns400() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file", "audio.webm", "audio/webm", "data".getBytes());

        mockMvc.perform(multipart("/api/practice/evaluate")
                        .file(file)
                        .param("expectedPhrase", "bonjour")
                        .param("lang", "zz")
                        .param("level", "B1"))
                .andExpect(status().isBadRequest());
    }

    // ── health ────────────────────────────────────────────────────────────────

    @Test
    void health_allUp_returns200() throws Exception {
        when(pythonSttClient.isHealthy()).thenReturn(true);
        when(ollamaService.isHealthy()).thenReturn(true);

        mockMvc.perform(get("/api/practice/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.overall").value("OK"))
                .andExpect(jsonPath("$.whisper_python").value("UP"))
                .andExpect(jsonPath("$.ollama").value("UP"));
    }

    @Test
    void health_whisperDown_returns503() throws Exception {
        when(pythonSttClient.isHealthy()).thenReturn(false);
        when(ollamaService.isHealthy()).thenReturn(true);

        mockMvc.perform(get("/api/practice/health"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.overall").value("DEGRADED"))
                .andExpect(jsonPath("$.whisper_python").value("DOWN"));
    }
}
