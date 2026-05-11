package com.example.prononciationtest.controller;

import com.example.prononciationtest.config.TestSecurityConfig;
import com.example.prononciationtest.entity.ExerciseProgress;
import com.example.prononciationtest.entity.User;
import com.example.prononciationtest.repository.ExerciseProgressRepository;
import com.example.prononciationtest.repository.UserRepository;
import com.example.prononciationtest.service.iservice.IGamificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(ExerciseProgressController.class)
@Import(TestSecurityConfig.class)
class ExerciseProgressControllerTest {

    @Autowired MockMvc mockMvc;

    @MockBean ExerciseProgressRepository progressRepo;
    @MockBean UserRepository             userRepo;
    @MockBean IGamificationService       gamificationService;

    private User alice;

    @BeforeEach
    void setUp() {
        alice = new User();
        alice.setId(1L);
        alice.setEmail("alice@test.com");
        alice.setCefrLevel("B1");
        alice.setCreatedAt(Instant.now());
        when(userRepo.findByEmail("alice@test.com")).thenReturn(Optional.of(alice));
    }

    // ── GET /api/exercises/progress ───────────────────────────────────────────

    @Test
    @WithMockUser(username = "alice@test.com")
    void getProgress_authenticated_returns200() throws Exception {
        ExerciseProgress p = new ExerciseProgress();
        p.setUserId(1L);
        p.setLevel("A1");
        p.setLang("fr");
        p.setDone(true);
        p.setMastered(true);
        p.setCompleted(10);
        p.setLastAvgScore(80);

        when(progressRepo.findByUserIdAndLang(1L, "fr")).thenReturn(List.of(p));
        when(progressRepo.existsByUserIdAndLevelAndLangAndDoneTrue(1L, "A1", "fr")).thenReturn(true);

        mockMvc.perform(get("/api/exercises/progress").param("lang", "fr"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.A1.done").value(true))
                .andExpect(jsonPath("$.A1.mastered").value(true))
                .andExpect(jsonPath("$.A1.lastAvgScore").value(80));
    }

    @Test
    void getProgress_unauthenticated_returns401() throws Exception {
        mockMvc.perform(get("/api/exercises/progress"))
                .andExpect(status().isUnauthorized());
    }

    // ── POST /api/exercises/progress/{level}/complete ─────────────────────────

    @Test
    @WithMockUser(username = "alice@test.com")
    void completeLevel_validLevel_returns200() throws Exception {
        when(progressRepo.findByUserIdAndLevelAndLang(1L, "A1", "fr")).thenReturn(Optional.empty());
        when(progressRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        doNothing().when(gamificationService).recordActivity(any(), anyInt(), anyInt());

        mockMvc.perform(post("/api/exercises/progress/A1/complete")
                        .param("avgScore", "75")
                        .param("totalPhrases", "10")
                        .param("lang", "fr"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.level").value("A1"))
                .andExpect(jsonPath("$.done").value(true))
                .andExpect(jsonPath("$.avgScore").value(75));

        verify(gamificationService).recordActivity(eq(alice), anyInt(), eq(75));
    }

    @Test
    @WithMockUser(username = "alice@test.com")
    void completeLevel_invalidLevel_returns400() throws Exception {
        mockMvc.perform(post("/api/exercises/progress/Z9/complete")
                        .param("avgScore", "75"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").exists());
    }

    @Test
    @WithMockUser(username = "alice@test.com")
    void completeLevel_mastered_whenScoreAbove60() throws Exception {
        when(progressRepo.findByUserIdAndLevelAndLang(1L, "B1", "fr")).thenReturn(Optional.empty());
        when(progressRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        doNothing().when(gamificationService).recordActivity(any(), anyInt(), anyInt());

        mockMvc.perform(post("/api/exercises/progress/B1/complete")
                        .param("avgScore", "70")
                        .param("lang", "fr"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mastered").value(true));
    }

    @Test
    @WithMockUser(username = "alice@test.com")
    void completeLevel_notMastered_whenScoreBelow60() throws Exception {
        when(progressRepo.findByUserIdAndLevelAndLang(1L, "B1", "fr")).thenReturn(Optional.empty());
        when(progressRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        doNothing().when(gamificationService).recordActivity(any(), anyInt(), anyInt());

        mockMvc.perform(post("/api/exercises/progress/B1/complete")
                        .param("avgScore", "45")
                        .param("lang", "fr"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mastered").value(false));
    }

    // ── GET /api/exercises/progress/{level} ───────────────────────────────────

    @Test
    @WithMockUser(username = "alice@test.com")
    void getLevelProgress_existing_returns200() throws Exception {
        ExerciseProgress p = new ExerciseProgress();
        p.setUserId(1L);
        p.setLevel("B1");
        p.setLang("fr");
        p.setDone(true);
        p.setMastered(true);
        p.setCompleted(10);
        p.setLastAvgScore(82);

        when(progressRepo.findByUserIdAndLevelAndLang(1L, "B1", "fr")).thenReturn(Optional.of(p));
        when(progressRepo.existsByUserIdAndLevelAndLangAndDoneTrue(1L, "A2", "fr")).thenReturn(true);

        mockMvc.perform(get("/api/exercises/progress/B1").param("lang", "fr"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.level").value("B1"))
                .andExpect(jsonPath("$.done").value(true))
                .andExpect(jsonPath("$.lastAvgScore").value(82));
    }

    @Test
    @WithMockUser(username = "alice@test.com")
    void getLevelProgress_notFound_returnsDefaultUnlocked() throws Exception {
        when(progressRepo.findByUserIdAndLevelAndLang(1L, "A1", "fr")).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/exercises/progress/A1").param("lang", "fr"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.level").value("A1"))
                .andExpect(jsonPath("$.done").value(false))
                .andExpect(jsonPath("$.unlocked").value(true));
    }
}
