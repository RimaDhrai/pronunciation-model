package com.example.prononciationtest.service;

import com.example.prononciationtest.entity.MasterSession;
import com.example.prononciationtest.repository.MasterSessionRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SessionMemoryServiceTest {

    @Mock
    private MasterSessionRepository masterSessionRepo;

    private ObjectMapper objectMapper;
    private SessionMemoryService sessionMemoryService;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        sessionMemoryService = new SessionMemoryService(masterSessionRepo, objectMapper);
    }

    @Test
    void getOrCreate_whenFreshSession_savesToDbAndReturnsFreshData() {
        when(masterSessionRepo.findBySessionId("fresh-session")).thenReturn(Optional.empty());

        SessionMemoryService.SessionData data = sessionMemoryService.getOrCreate("fresh-session", "fr", "A2");

        assertThat(data).isNotNull();
        assertThat(data.sessionId).isEqualTo("fresh-session");
        assertThat(data.lang).isEqualTo("fr");
        assertThat(data.cefrLevel).isEqualTo("A2");

        verify(masterSessionRepo, timeout(1000)).save(any(MasterSession.class));
    }

    @Test
    void getOrCreate_whenSessionInDb_restoresAndReturnsCachedData() {
        MasterSession ms = new MasterSession();
        ms.setSessionId("db-session");
        ms.setLang("en");
        ms.setCefrLevel("B2");
        ms.setTotalXp(150);
        ms.setErrorLogJson("[\"hello\", \"world\"]");

        when(masterSessionRepo.findBySessionId("db-session")).thenReturn(Optional.of(ms));

        SessionMemoryService.SessionData data = sessionMemoryService.getOrCreate("db-session", "fr", "A2");

        assertThat(data).isNotNull();
        assertThat(data.sessionId).isEqualTo("db-session");
        assertThat(data.lang).isEqualTo("en");
        assertThat(data.cefrLevel).isEqualTo("B2");
        assertThat(data.totalXp).isEqualTo(150);
        assertThat(data.errorLog).containsExactly("hello", "world");
    }

    @Test
    void exists_whenSessionInDb_restoresToMemoryAndReturnsTrue() {
        MasterSession ms = new MasterSession();
        ms.setSessionId("exists-session");
        ms.setLang("fr");
        ms.setCefrLevel("A1");

        when(masterSessionRepo.findBySessionId("exists-session")).thenReturn(Optional.of(ms));

        boolean exists = sessionMemoryService.exists("exists-session");

        assertThat(exists).isTrue();
        assertThat(sessionMemoryService.get("exists-session")).isNotNull();
    }

    @Test
    void remove_removesFromMemoryAndDb() {
        MasterSession ms = new MasterSession();
        ms.setSessionId("delete-session");
        when(masterSessionRepo.findBySessionId("delete-session")).thenReturn(Optional.of(ms));

        sessionMemoryService.remove("delete-session");

        assertThat(sessionMemoryService.get("delete-session")).isNull();
        verify(masterSessionRepo).delete(ms);
    }

    @Test
    void mutations_updateDataCorrectly() {
        // Create initial session in memory
        when(masterSessionRepo.findBySessionId("session-mutations")).thenReturn(Optional.empty());
        sessionMemoryService.getOrCreate("session-mutations", "fr", "B1");

        // Test Cefr level
        sessionMemoryService.updateCefrLevel("session-mutations", "C1");
        assertThat(sessionMemoryService.getCefrLevel("session-mutations")).isEqualTo("C1");

        // Test XP
        sessionMemoryService.addXp("session-mutations", 30);
        assertThat(sessionMemoryService.getTotalXp("session-mutations")).isEqualTo(30);

        // Test weak words
        sessionMemoryService.addWeakWords("session-mutations", List.of("hello", "TEST", "hello"));
        assertThat(sessionMemoryService.getErrorLog("session-mutations")).containsExactly("hello", "test");

        sessionMemoryService.removeWeakWord("session-mutations", "hello");
        assertThat(sessionMemoryService.getErrorLog("session-mutations")).containsExactly("test");

        // Test Chat/Exercise rounds
        sessionMemoryService.incrementExerciseRound("session-mutations");
        assertThat(sessionMemoryService.getExerciseRound("session-mutations")).isEqualTo(1);

        sessionMemoryService.incrementChatRound("session-mutations");
        assertThat(sessionMemoryService.getChatRound("session-mutations")).isEqualTo(1);

        // Test TestSessionId
        sessionMemoryService.setTestSessionId("session-mutations", "test-123");
        assertThat(sessionMemoryService.getTestSessionId("session-mutations")).isEqualTo("test-123");
    }
}
