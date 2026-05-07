package com.example.prononciationtest.controller;

import com.example.prononciationtest.config.TestSecurityConfig;
import com.example.prononciationtest.repository.PasswordResetTokenRepository;
import com.example.prononciationtest.repository.UserRepository;
import com.example.prononciationtest.service.EmailService;
import com.example.prononciationtest.service.iservice.IKeycloakAdminService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AuthController.class)
@Import(TestSecurityConfig.class)
class AuthControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;

    @MockBean IKeycloakAdminService keycloakAdmin;
    @MockBean UserRepository        userRepository;
    @MockBean PasswordEncoder       passwordEncoder;
    @MockBean PasswordResetTokenRepository tokenRepository;
    @MockBean EmailService          emailService;

    // ── register ──────────────────────────────────────────────────────────────

    @Test
    void register_validBody_returns201() throws Exception {
        when(userRepository.existsByEmail("alice@test.com")).thenReturn(false);
        doNothing().when(keycloakAdmin).createUser(any(), any(), any());
        when(passwordEncoder.encode(any())).thenReturn("hashed");

        Map<String, String> body = Map.of(
                "email", "alice@test.com",
                "password", "secret",
                "fullName", "Alice Test");

        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.message").value("Compte créé avec succès"))
                .andExpect(jsonPath("$.email").value("alice@test.com"));
    }

    @Test
    void register_missingEmail_returns400() throws Exception {
        Map<String, String> body = Map.of(
                "password", "secret",
                "fullName", "Alice Test");

        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").exists());
    }

    @Test
    void register_blankPassword_returns400() throws Exception {
        Map<String, String> body = Map.of(
                "email", "alice@test.com",
                "password", "   ",
                "fullName", "Alice Test");

        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void register_duplicateEmail_returns409() throws Exception {
        when(userRepository.existsByEmail("alice@test.com")).thenReturn(true);

        Map<String, String> body = Map.of(
                "email", "alice@test.com",
                "password", "secret",
                "fullName", "Alice Test");

        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Adresse email déjà utilisée"));
    }

    @Test
    void register_keycloakConflict_returns409() throws Exception {
        when(userRepository.existsByEmail("alice@test.com")).thenReturn(false);
        doThrow(new IllegalArgumentException("Email déjà utilisé dans Keycloak : alice@test.com"))
                .when(keycloakAdmin).createUser(any(), any(), any());

        Map<String, String> body = Map.of(
                "email", "alice@test.com",
                "password", "secret",
                "fullName", "Alice Test");

        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isConflict());
    }

    @Test
    void register_keycloakDown_returns502() throws Exception {
        when(userRepository.existsByEmail("alice@test.com")).thenReturn(false);
        doThrow(new RuntimeException("Connection refused"))
                .when(keycloakAdmin).createUser(any(), any(), any());

        Map<String, String> body = Map.of(
                "email", "alice@test.com",
                "password", "secret",
                "fullName", "Alice Test");

        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isBadGateway());
    }
}
