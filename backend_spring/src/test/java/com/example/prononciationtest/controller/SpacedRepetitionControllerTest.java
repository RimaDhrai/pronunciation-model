package com.example.prononciationtest.controller;

import com.example.prononciationtest.config.TestSecurityConfig;
import com.example.prononciationtest.entity.SpacedRepetitionItem;
import com.example.prononciationtest.entity.User;
import com.example.prononciationtest.repository.SpacedRepetitionRepository;
import com.example.prononciationtest.repository.UserRepository;
import com.example.prononciationtest.service.SessionMemoryService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(SpacedRepetitionController.class)
@Import(TestSecurityConfig.class)
class SpacedRepetitionControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;

    @MockBean SpacedRepetitionRepository srRepo;
    @MockBean UserRepository             userRepo;
    @MockBean SessionMemoryService       sessionMemory;

    private User alice;

    @BeforeEach
    void setUp() {
        alice = new User();
        alice.setId(1L);
        alice.setEmail("alice@test.com");
        alice.setCreatedAt(Instant.now());
        when(userRepo.findByEmail("alice@test.com")).thenReturn(Optional.of(alice));
    }

    // ── POST /api/spaced-repetition/errors ────────────────────────────────────

    @Test
    @WithMockUser(username = "alice@test.com")
    void recordErrors_validWords_returns200() throws Exception {
        when(srRepo.findByUserIdAndWordIgnoreCase(1L, "bonjour")).thenReturn(Optional.empty());
        when(srRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        List<Map<String, String>> words = List.of(
                Map.of("word", "bonjour", "level", "B1"),
                Map.of("word", "merci",   "level", "A1"));

        mockMvc.perform(post("/api/spaced-repetition/errors")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(words)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.recorded").value(2));
    }

    @Test
    @WithMockUser(username = "alice@test.com")
    void recordErrors_existingWord_incrementsErrorCount() throws Exception {
        SpacedRepetitionItem existing = new SpacedRepetitionItem();
        existing.setId(5L);
        existing.setUserId(1L);
        existing.setWord("bonjour");
        existing.setErrorCount(2);
        existing.setIntervalDays(1);
        existing.setLastSeen(LocalDate.now().minusDays(1));
        existing.setNextReview(LocalDate.now());

        when(srRepo.findByUserIdAndWordIgnoreCase(1L, "bonjour")).thenReturn(Optional.of(existing));
        when(srRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        List<Map<String, String>> words = List.of(Map.of("word", "bonjour", "level", "B1"));

        mockMvc.perform(post("/api/spaced-repetition/errors")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(words)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.recorded").value(1));

        verify(srRepo).save(argThat(item -> item.getErrorCount() == 3));
    }

    // ── GET /api/spaced-repetition/due ────────────────────────────────────────

    @Test
    @WithMockUser(username = "alice@test.com")
    void getDue_returnsDueItems() throws Exception {
        SpacedRepetitionItem item = new SpacedRepetitionItem();
        item.setId(1L);
        item.setWord("chien");
        item.setLevel("A1");
        item.setErrorCount(3);

        when(srRepo.findByUserIdAndNextReviewLessThanEqual(eq(1L), any()))
                .thenReturn(List.of(item));

        mockMvc.perform(get("/api/spaced-repetition/due"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(1))
                .andExpect(jsonPath("$.due[0].word").value("chien"))
                .andExpect(jsonPath("$.due[0].errorCount").value(3));
    }

    // ── GET /api/spaced-repetition/count ──────────────────────────────────────

    @Test
    @WithMockUser(username = "alice@test.com")
    void getCount_returnsCount() throws Exception {
        when(srRepo.countByUserIdAndNextReviewLessThanEqual(eq(1L), any())).thenReturn(5L);

        mockMvc.perform(get("/api/spaced-repetition/count"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(5));
    }

    // ── POST /api/spaced-repetition/{id}/reviewed ─────────────────────────────

    @Test
    @WithMockUser(username = "alice@test.com")
    void markReviewed_ownedItem_returns200() throws Exception {
        SpacedRepetitionItem item = new SpacedRepetitionItem();
        item.setId(10L);
        item.setUserId(1L);
        item.setIntervalDays(1);
        item.setNextReview(LocalDate.now().plusDays(3));

        when(srRepo.findById(10L)).thenReturn(Optional.of(item));
        when(srRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        mockMvc.perform(post("/api/spaced-repetition/10/reviewed"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nextReview").exists());
    }

    @Test
    @WithMockUser(username = "alice@test.com")
    void markReviewed_notFound_returns404() throws Exception {
        when(srRepo.findById(99L)).thenReturn(Optional.empty());

        mockMvc.perform(post("/api/spaced-repetition/99/reviewed"))
                .andExpect(status().isNotFound());
    }

    @Test
    @WithMockUser(username = "alice@test.com")
    void markReviewed_differentUser_returns404() throws Exception {
        SpacedRepetitionItem item = new SpacedRepetitionItem();
        item.setId(10L);
        item.setUserId(99L); // belongs to another user

        when(srRepo.findById(10L)).thenReturn(Optional.of(item));

        mockMvc.perform(post("/api/spaced-repetition/10/reviewed"))
                .andExpect(status().isNotFound());
    }
}
