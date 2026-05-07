package com.example.prononciationtest.controller;

import com.example.prononciationtest.config.TestSecurityConfig;
import com.example.prononciationtest.entity.User;
import com.example.prononciationtest.entity.UserSession;
import com.example.prononciationtest.repository.BadgeRepository;
import com.example.prononciationtest.repository.CEFRSessionRepository;
import com.example.prononciationtest.repository.UserRepository;
import com.example.prononciationtest.repository.UserSessionRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(UserController.class)
@Import(TestSecurityConfig.class)
class UserControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;

    @MockBean UserRepository        userRepository;
    @MockBean UserSessionRepository userSessionRepository;
    @MockBean PasswordEncoder       passwordEncoder;
    @MockBean BadgeRepository       badgeRepository;
    @MockBean CEFRSessionRepository cefrSessionRepository;

    private User alice;

    @BeforeEach
    void setUp() {
        alice = new User();
        alice.setId(1L);
        alice.setEmail("alice@test.com");
        alice.setFullName("Alice Test");
        alice.setEnabled(true);
        alice.setCefrLevel("B1");
        alice.setCreatedAt(Instant.now());
    }

    // ── GET /api/user/me ──────────────────────────────────────────────────────

    @Test
    @WithMockUser(username = "alice@test.com")
    void me_authenticated_returns200() throws Exception {
        when(userRepository.findByEmail("alice@test.com")).thenReturn(Optional.of(alice));
        when(badgeRepository.findByUserId(1L)).thenReturn(List.of());

        mockMvc.perform(get("/api/user/me"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("alice@test.com"))
                .andExpect(jsonPath("$.fullName").value("Alice Test"))
                .andExpect(jsonPath("$.cefrLevel").value("B1"));
    }

    @Test
    void me_unauthenticated_returns401() throws Exception {
        mockMvc.perform(get("/api/user/me"))
                .andExpect(status().isUnauthorized());
    }

    // ── PUT /api/user/profile ─────────────────────────────────────────────────

    @Test
    @WithMockUser(username = "alice@test.com")
    void updateProfile_validRequest_returns200() throws Exception {
        when(userRepository.findByEmail("alice@test.com")).thenReturn(Optional.of(alice));
        when(userRepository.save(any())).thenReturn(alice);

        Map<String, String> body = Map.of(
                "fullName", "Alice Updated",
                "jobTitle", "Engineer",
                "nativeLang", "fr");

        mockMvc.perform(put("/api/user/profile")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk());

        verify(userRepository).save(any());
    }

    @Test
    @WithMockUser(username = "alice@test.com")
    void updateProfile_missingFullName_returns400() throws Exception {
        when(userRepository.findByEmail("alice@test.com")).thenReturn(Optional.of(alice));

        Map<String, String> body = Map.of("jobTitle", "Engineer");

        mockMvc.perform(put("/api/user/profile")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isBadRequest());
    }

    // ── PUT /api/user/progress ────────────────────────────────────────────────

    @Test
    @WithMockUser(username = "alice@test.com")
    void updateProgress_validRequest_returns200() throws Exception {
        when(userRepository.findByEmail("alice@test.com")).thenReturn(Optional.of(alice));
        when(userRepository.save(any())).thenReturn(alice);

        Map<String, Object> body = Map.of(
                "cefr_level", "C1",
                "cefr_completed", true);

        mockMvc.perform(put("/api/user/progress")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk());

        verify(userRepository).save(argThat(u -> "C1".equals(u.getCefrLevel())));
    }

    // ── GET /api/user/sessions ────────────────────────────────────────────────

    @Test
    @WithMockUser(username = "alice@test.com")
    void getSessions_authenticated_returnsList() throws Exception {
        when(userRepository.findByEmail("alice@test.com")).thenReturn(Optional.of(alice));

        UserSession session = new UserSession();
        session.setId(10L);
        session.setType("practice");
        session.setPhrase("bonjour");
        session.setScore(80);
        session.setLang("fr");
        session.setLevel("B1");
        session.setFeedback("Bien !");
        session.setCreatedAt(LocalDateTime.now());

        when(userSessionRepository.findByUserIdOrderByCreatedAtDesc(1L))
                .thenReturn(List.of(session));

        mockMvc.perform(get("/api/user/sessions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].phrase").value("bonjour"))
                .andExpect(jsonPath("$[0].score").value(80));
    }

    // ── POST /api/user/sessions ───────────────────────────────────────────────

    @Test
    @WithMockUser(username = "alice@test.com")
    void saveSession_validRequest_returns200() throws Exception {
        when(userRepository.findByEmail("alice@test.com")).thenReturn(Optional.of(alice));
        when(userSessionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Map<String, Object> body = Map.of(
                "type", "practice",
                "phrase", "bonjour le monde",
                "score", 90,
                "lang", "fr",
                "level", "B1",
                "feedback", "Super !");

        mockMvc.perform(post("/api/user/sessions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.saved").value(true));
    }
}
