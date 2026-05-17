package com.example.prononciationtest.agent;

import com.example.prononciationtest.entity.MasterSession;
import com.example.prononciationtest.repository.MasterSessionRepository;
import com.example.prononciationtest.service.OllamaService;
import com.example.prononciationtest.service.SessionMemoryService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MasterAgentTest {

    @Mock ChatbotAgent      chatbotAgent;
    @Mock LevelTestAgent    levelTestAgent;
    @Mock OllamaService     ollamaService;
    @Mock MasterSessionRepository masterSessionRepo;

    SessionMemoryService sessionMemory;
    MasterAgent          agent;

    private static final String SID = "test-session-1";

    @BeforeEach
    void setUp() {
        lenient().when(masterSessionRepo.findBySessionId(any())).thenReturn(Optional.empty());
        lenient().when(masterSessionRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        sessionMemory = new SessionMemoryService(masterSessionRepo, new ObjectMapper());
        agent = new MasterAgent(chatbotAgent, levelTestAgent, ollamaService, sessionMemory);
        // Seed a live session in memory so all turns find it
        sessionMemory.getOrCreate(SID, "fr", "B1");
    }

    // â”€â”€ turn â€” SESSION_NOT_FOUND guard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    @Test
    void turn_unknownSession_returnsSessionNotFound() {
        var result = agent.turn("ghost", "CHAT", "fr", "hello",
                null, null, null, null, null, null);

        assertThat(result).containsKey("error");
        assertThat(result.get("error")).isEqualTo("SESSION_NOT_FOUND");
    }

    // â”€â”€ XP formula (computeXp) via EXERCISE turn â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    @Test
    void turn_exercise_score90OrAbove_earns15Xp() {
        when(ollamaService.generatePhrase(any(), any())).thenReturn("Dis bonjour.");

        var result = agent.turn(SID, "EXERCISE", "fr", null,
                null, null, null, 92, null, null);

        assertThat(result.get("xp_earned")).isEqualTo(15);
    }

    @Test
    void turn_exercise_score75to89_earns10Xp() {
        when(ollamaService.generatePhrase(any(), any())).thenReturn("Dis bonjour.");

        var result = agent.turn(SID, "EXERCISE", "fr", null,
                null, null, null, 80, null, null);

        assertThat(result.get("xp_earned")).isEqualTo(10);
    }

    @Test
    void turn_exercise_score60to74_earns5Xp() {
        when(ollamaService.generatePhrase(any(), any())).thenReturn("Dis bonjour.");

        var result = agent.turn(SID, "EXERCISE", "fr", null,
                null, null, null, 65, null, null);

        assertThat(result.get("xp_earned")).isEqualTo(5);
    }

    @Test
    void turn_exercise_scoreBelw60_earns2Xp() {
        when(ollamaService.generatePhrase(any(), any())).thenReturn("Dis bonjour.");

        var result = agent.turn(SID, "EXERCISE", "fr", null,
                null, null, null, 40, null, null);

        assertThat(result.get("xp_earned")).isEqualTo(2);
    }

    // â”€â”€ XP accumulation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    @Test
    void turn_exercise_multipleRounds_totalXpAccumulates() {
        when(ollamaService.generatePhrase(any(), any())).thenReturn("Phrase test.");

        agent.turn(SID, "EXERCISE", "fr", null, null, null, null, 95, null, null); // +15
        agent.turn(SID, "EXERCISE", "fr", null, null, null, null, 78, null, null); // +10

        assertThat(sessionMemory.getTotalXp(SID)).isEqualTo(25);
    }

    // â”€â”€ exercise round increment â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    @Test
    void turn_exercise_incrementsRoundEachCall() {
        when(ollamaService.generatePhrase(any(), any())).thenReturn("Phrase.");

        agent.turn(SID, "EXERCISE", "fr", null, null, null, null, null, null, null);
        agent.turn(SID, "EXERCISE", "fr", null, null, null, null, null, null, null);

        var result = (Map<String, Object>) agent.turn(
                SID, "EXERCISE", "fr", null, null, null, null, null, null, null);

        assertThat(result.get("round")).isEqualTo(3);
    }

    // â”€â”€ score labels â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    @Test
    void turn_exercise_scoreLabel_excellent() {
        when(ollamaService.generatePhrase(any(), any())).thenReturn("X.");
        var result = agent.turn(SID, "EXERCISE", "fr", null, null, null, null, 91, null, null);
        assertThat(result.get("score_label")).isEqualTo("Excellent");
    }

    @Test
    void turn_exercise_scoreLabel_bien() {
        when(ollamaService.generatePhrase(any(), any())).thenReturn("X.");
        var result = agent.turn(SID, "EXERCISE", "fr", null, null, null, null, 75, null, null);
        assertThat(result.get("score_label")).isEqualTo("Bien");
    }

    @Test
    void turn_exercise_scoreLabel_passable() {
        when(ollamaService.generatePhrase(any(), any())).thenReturn("X.");
        var result = agent.turn(SID, "EXERCISE", "fr", null, null, null, null, 60, null, null);
        assertThat(result.get("score_label")).isEqualTo("Passable");
    }

    @Test
    void turn_exercise_scoreLabel_aAmeliorer() {
        when(ollamaService.generatePhrase(any(), any())).thenReturn("X.");
        var result = agent.turn(SID, "EXERCISE", "fr", null, null, null, null, 59, null, null);
        assertThat(result.get("score_label")).isEqualTo("À améliorer");
    }

    // â”€â”€ phoneme errors propagated to error_log regardless of mode â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    @Test
    void turn_exercise_phonemeErrors_persistedToErrorLog() {
        when(ollamaService.generatePhrase(any(), any())).thenReturn("X.");

        agent.turn(SID, "EXERCISE", "fr", null, null, null, null, 80, null,
                List.of("son", "bruit"));

        assertThat(sessionMemory.getErrorLog(SID)).containsExactlyInAnyOrder("son", "bruit");
    }

    @Test
    void turn_chat_phonemeErrors_persistedToErrorLog() {
        when(chatbotAgent.chat(any(), any(), any(), any())).thenReturn("Bravo !");

        agent.turn(SID, "CHAT", "fr", "Bonjour", null, null, null, null, null,
                List.of("mot1", "mot2"));

        assertThat(sessionMemory.getErrorLog(SID)).containsExactlyInAnyOrder("mot1", "mot2");
    }

    // â”€â”€ getStats â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    @Test
    void getStats_unknownSession_returnsError() {
        var stats = agent.getStats("unknown");
        assertThat(stats).containsKey("error");
    }

    @Test
    void getStats_knownSession_returnsAllFields() {
        sessionMemory.addXp(SID, 20);
        sessionMemory.incrementChatRound(SID);
        sessionMemory.incrementExerciseRound(SID);
        sessionMemory.addWeakWords(SID, List.of("mot"));

        var stats = agent.getStats(SID);

        assertThat(stats.get("session_id")).isEqualTo(SID);
        assertThat(stats.get("total_xp")).isEqualTo(20);
        assertThat(stats.get("chat_round")).isEqualTo(1);
        assertThat(stats.get("exercise_round")).isEqualTo(1);
        assertThat((List<String>) stats.get("error_log")).contains("mot");
    }

    // â”€â”€ createSession â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    @Test
    void createSession_returnsSessionIdAndGreeting() {
        when(chatbotAgent.startSession(any(), any(), any(), any()))
                .thenReturn("Bonjour ! Prêt à pratiquer ?");

        var result = agent.createSession("new-s", "fr", "A2", "voyage");

        assertThat(result.get("session_id")).isEqualTo("new-s");
        assertThat(result.get("greeting")).isEqualTo("Bonjour ! Prêt à pratiquer ?");
        assertThat(result.get("cefr_level")).isEqualTo("A2");
    }

    // â”€â”€ TEST mode: CEFR level propagation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    @Test
    void turn_testFinish_propagatesCefrLevel() {
        sessionMemory.setTestSessionId(SID, SID);

        Map<String, Object> finishResult = new HashMap<>();
        finishResult.put("final_level", "C1");
        finishResult.put("weaknesses", List.of("liaison"));
        when(levelTestAgent.finish(SID)).thenReturn(finishResult);

        agent.turn(SID, "TEST_FINISH", "fr", null, null, null, null, null, null, null);

        assertThat(sessionMemory.getCefrLevel(SID)).isEqualTo("C1");
        assertThat(sessionMemory.getErrorLog(SID)).contains("liaison");
        assertThat(sessionMemory.getTestSessionId(SID)).isNull();
    }

    // â”€â”€ mode normalization â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    @Test
    void turn_modeIsCaseInsensitive() {
        when(ollamaService.generatePhrase(any(), any())).thenReturn("Phrase.");

        var result = agent.turn(SID, "exercise", "fr", null, null, null, null, 80, null, null);

        assertThat(result.get("mode")).isEqualTo("EXERCISE");
    }

    @Test
    void turn_nullMode_defaultsToChat() {
        when(chatbotAgent.chat(any(), any(), any(), any())).thenReturn("Réponse.");

        var result = agent.turn(SID, null, "fr", "hello", null, null, null, null, null, null);

        assertThat(result.get("mode")).isEqualTo("CHAT");
    }
}
