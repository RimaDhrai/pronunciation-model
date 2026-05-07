package com.example.prononciationtest.controller;

import com.example.prononciationtest.agent.ChatbotAgent;
import com.example.prononciationtest.config.TestSecurityConfig;
import com.example.prononciationtest.service.SessionMemoryService;
import com.example.prononciationtest.service.dto.ChatSttResponse;
import com.example.prononciationtest.service.iservice.IChatbotFastApiClient;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(ChatbotController.class)
@Import(TestSecurityConfig.class)
class ChatbotControllerTest {

    @Autowired MockMvc mockMvc;

    @MockBean ChatbotAgent          chatbotAgent;
    @MockBean IChatbotFastApiClient chatbotClient;
    @MockBean SessionMemoryService  sessionMemory;

    // ── startSession ──────────────────────────────────────────────────────────

    @Test
    void startSession_ok_returns200() throws Exception {
        when(chatbotAgent.startSession(anyString(), eq("fr"), eq("B1"), eq("")))
                .thenReturn("Bonjour !");
        when(chatbotClient.chatTts(any(), any())).thenReturn("base64audio");

        mockMvc.perform(post("/api/chat/session/start")
                        .param("lang", "fr")
                        .param("level", "B1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.session_id").exists())
                .andExpect(jsonPath("$.greeting").value("Bonjour !"))
                .andExpect(jsonPath("$.audio_base64").value("base64audio"));
    }

    @Test
    void startSession_agentError_returns500() throws Exception {
        when(chatbotAgent.startSession(any(), any(), any(), any()))
                .thenThrow(new RuntimeException("agent failed"));

        mockMvc.perform(post("/api/chat/session/start")
                        .param("lang", "fr")
                        .param("level", "B1"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.error").exists());
    }

    // ── sendVoice ─────────────────────────────────────────────────────────────

    @Test
    void sendVoice_ok_returns200() throws Exception {
        ChatSttResponse stt = new ChatSttResponse();
        stt.setCleanText("bonjour");
        stt.setWeakWords(List.of());
        stt.setAvgConfidence(0.9);
        stt.setPronScore(90);
        stt.setPronFeedback("excellent");

        when(chatbotAgent.sessionExists("sess-123")).thenReturn(true);
        when(chatbotClient.chatStt(any(), eq("fr"))).thenReturn(stt);
        when(chatbotAgent.chat(eq("sess-123"), eq("bonjour"), any(), any()))
                .thenReturn("Très bien !");
        when(chatbotClient.chatTts(any(), any())).thenReturn("");

        MockMultipartFile audio = new MockMultipartFile(
                "audio", "rec.webm", "audio/webm", "fake".getBytes());

        mockMvc.perform(multipart("/api/chat/voice")
                        .file(audio)
                        .param("session_id", "sess-123")
                        .param("native_lang", "fr"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user_transcript").value("bonjour"))
                .andExpect(jsonPath("$.coach_response").value("Très bien !"))
                .andExpect(jsonPath("$.pron_score").value(90));
    }

    @Test
    void sendVoice_sessionNotFound_returns404() throws Exception {
        when(chatbotAgent.sessionExists("expired")).thenReturn(false);

        MockMultipartFile audio = new MockMultipartFile(
                "audio", "rec.webm", "audio/webm", "fake".getBytes());

        mockMvc.perform(multipart("/api/chat/voice")
                        .file(audio)
                        .param("session_id", "expired")
                        .param("native_lang", "fr"))
                .andExpect(status().isNotFound());
    }

    @Test
    void sendVoice_sttError_returnsRetry() throws Exception {
        ChatSttResponse stt = new ChatSttResponse();
        stt.setError("Je n'ai pas bien compris — réessaie.");
        stt.setRetry(true);

        when(chatbotAgent.sessionExists("sess-123")).thenReturn(true);
        when(chatbotClient.chatStt(any(), any())).thenReturn(stt);

        MockMultipartFile audio = new MockMultipartFile(
                "audio", "rec.webm", "audio/webm", "fake".getBytes());

        mockMvc.perform(multipart("/api/chat/voice")
                        .file(audio)
                        .param("session_id", "sess-123")
                        .param("native_lang", "fr"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.error").exists())
                .andExpect(jsonPath("$.retry").value(true));
    }

    // ── sendText ──────────────────────────────────────────────────────────────

    @Test
    void sendText_ok_returns200() throws Exception {
        when(chatbotAgent.sessionExists("sess-123")).thenReturn(true);
        when(chatbotAgent.chat(eq("sess-123"), eq("Bonjour"), any(), any()))
                .thenReturn("Super !");
        when(chatbotClient.chatTts(any(), any())).thenReturn("");

        mockMvc.perform(post("/api/chat/text")
                        .param("session_id", "sess-123")
                        .param("message", "Bonjour"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.coach_response").value("Super !"));
    }

    @Test
    void sendText_sessionNotFound_returns404() throws Exception {
        when(chatbotAgent.sessionExists(any())).thenReturn(false);

        mockMvc.perform(post("/api/chat/text")
                        .param("session_id", "expired")
                        .param("message", "test"))
                .andExpect(status().isNotFound());
    }

    // ── endSession ────────────────────────────────────────────────────────────

    @Test
    void endSession_ok_returns200() throws Exception {
        doNothing().when(chatbotAgent).endSession("sess-123");

        mockMvc.perform(delete("/api/chat/session/sess-123"))
                .andExpect(status().isOk());

        verify(chatbotAgent).endSession("sess-123");
    }

    @Test
    void endSession_errorIgnored_stillReturns200() throws Exception {
        doNothing().when(chatbotAgent).endSession(any());

        mockMvc.perform(delete("/api/chat/session/missing"))
                .andExpect(status().isOk());
    }
}
