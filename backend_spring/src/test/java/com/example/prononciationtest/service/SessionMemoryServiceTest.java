package com.example.prononciationtest.service;

import com.example.prononciationtest.entity.MasterSession;
import com.example.prononciationtest.repository.MasterSessionRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SessionMemoryServiceTest {

    @Mock
    MasterSessionRepository repo;

    SessionMemoryService service;

    @BeforeEach
    void setUp() {
        service = new SessionMemoryService(repo, new ObjectMapper());
        lenient().when(repo.findBySessionId(any())).thenReturn(Optional.empty());
        lenient().when(repo.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    // ── getOrCreate ───────────────────────────────────────────────────────────

    @Test
    void getOrCreate_freshSession_initializesDefaults() {
        var session = service.getOrCreate("s1", "fr", "B1");

        assertThat(session.sessionId).isEqualTo("s1");
        assertThat(session.lang).isEqualTo("fr");
        assertThat(session.cefrLevel).isEqualTo("B1");
        assertThat(session.totalXp).isZero();
        assertThat(session.errorLog).isEmpty();
    }

    @Test
    void getOrCreate_nullLangAndLevel_usesDefaults() {
        var session = service.getOrCreate("s2", null, null);

        assertThat(session.lang).isEqualTo("fr");
        assertThat(session.cefrLevel).isEqualTo("B1");
    }

    @Test
    void getOrCreate_restoredFromDb_populatesFields() throws Exception {
        MasterSession entity = new MasterSession();
        entity.setSessionId("s3");
        entity.setLang("en");
        entity.setCefrLevel("C1");
        entity.setTotalXp(120);
        entity.setExerciseRound(3);
        entity.setChatRound(2);
        entity.setErrorLogJson("[\"mots\",\"chien\"]");

        when(repo.findBySessionId("s3")).thenReturn(Optional.of(entity));

        var session = service.getOrCreate("s3", "fr", "B1");

        assertThat(session.lang).isEqualTo("en");
        assertThat(session.cefrLevel).isEqualTo("C1");
        assertThat(session.totalXp).isEqualTo(120);
        assertThat(session.exerciseRound).isEqualTo(3);
        assertThat(session.chatRound).isEqualTo(2);
        assertThat(session.errorLog).containsExactly("mots", "chien");
    }

    // ── addWeakWords — deduplication ──────────────────────────────────────────

    @Test
    void addWeakWords_newWords_addsAll() {
        service.getOrCreate("s4", "fr", "A2");
        service.addWeakWords("s4", List.of("Bonjour", "merci", "café"));

        assertThat(service.getErrorLog("s4")).containsExactlyInAnyOrder("bonjour", "merci", "café");
    }

    @Test
    void addWeakWords_duplicateDifferentCase_addedOnlyOnce() {
        service.getOrCreate("s5", "fr", "A2");
        service.addWeakWords("s5", List.of("Bonjour"));
        service.addWeakWords("s5", List.of("BONJOUR", "bonjour"));

        assertThat(service.getErrorLog("s5")).hasSize(1);
        assertThat(service.getErrorLog("s5")).containsExactly("bonjour");
    }

    @Test
    void addWeakWords_blankEntries_ignored() {
        service.getOrCreate("s6", "fr", "B1");
        service.addWeakWords("s6", Arrays.asList("", "  ", null, "chien"));

        assertThat(service.getErrorLog("s6")).containsExactly("chien");
    }

    @Test
    void addWeakWords_sameCallDuplicates_deduped() {
        service.getOrCreate("s7", "fr", "B1");
        service.addWeakWords("s7", List.of("chien", "chat", "chien"));

        assertThat(service.getErrorLog("s7")).containsExactlyInAnyOrder("chien", "chat");
    }

    // ── removeWeakWord ────────────────────────────────────────────────────────

    @Test
    void removeWeakWord_existingWord_removed() {
        service.getOrCreate("s8", "fr", "B1");
        service.addWeakWords("s8", List.of("chien", "chat"));
        service.removeWeakWord("s8", "Chien"); // case-insensitive

        assertThat(service.getErrorLog("s8")).containsExactly("chat");
    }

    @Test
    void removeWeakWord_unknownWord_noError() {
        service.getOrCreate("s9", "fr", "B1");
        service.addWeakWords("s9", List.of("chien"));
        service.removeWeakWord("s9", "inexistant");

        assertThat(service.getErrorLog("s9")).containsExactly("chien");
    }

    @Test
    void removeWeakWord_nullWord_noError() {
        service.getOrCreate("s10", "fr", "B1");
        service.addWeakWords("s10", List.of("chien"));
        service.removeWeakWord("s10", null);

        assertThat(service.getErrorLog("s10")).containsExactly("chien");
    }

    // ── chatRound ─────────────────────────────────────────────────────────────

    @Test
    void chatRound_startsAtZero() {
        service.getOrCreate("s11", "fr", "B1");

        assertThat(service.getChatRound("s11")).isZero();
    }

    @Test
    void chatRound_incrementsCorrectly() {
        service.getOrCreate("s12", "fr", "B1");
        service.incrementChatRound("s12");
        service.incrementChatRound("s12");
        service.incrementChatRound("s12");

        assertThat(service.getChatRound("s12")).isEqualTo(3);
    }

    @Test
    void chatRound_unknownSession_returnsZero() {
        assertThat(service.getChatRound("nonexistent")).isZero();
    }

    // ── exerciseRound ─────────────────────────────────────────────────────────

    @Test
    void exerciseRound_incrementsIndependentlyFromChatRound() {
        service.getOrCreate("s13", "fr", "B1");
        service.incrementChatRound("s13");
        service.incrementExerciseRound("s13");
        service.incrementExerciseRound("s13");

        assertThat(service.getChatRound("s13")).isEqualTo(1);
        assertThat(service.getExerciseRound("s13")).isEqualTo(2);
    }

    // ── XP ────────────────────────────────────────────────────────────────────

    @Test
    void addXp_accumulatesCorrectly() {
        service.getOrCreate("s14", "fr", "B1");
        service.addXp("s14", 10);
        service.addXp("s14", 5);

        assertThat(service.getTotalXp("s14")).isEqualTo(15);
    }

    @Test
    void getTotalXp_unknownSession_returnsZero() {
        assertThat(service.getTotalXp("ghost")).isZero();
    }

    // ── exists ────────────────────────────────────────────────────────────────

    @Test
    void exists_knownSession_returnsTrue() {
        service.getOrCreate("s15", "fr", "B1");

        assertThat(service.exists("s15")).isTrue();
    }

    @Test
    void exists_unknownSessionNotInDb_returnsFalse() {
        assertThat(service.exists("missing")).isFalse();
    }

    @Test
    void exists_unknownSessionInDb_restoresToMemoryAndReturnsTrue() {
        MasterSession entity = new MasterSession();
        entity.setSessionId("s16");
        entity.setLang("fr");
        entity.setCefrLevel("B2");
        entity.setTotalXp(0);
        entity.setExerciseRound(0);
        entity.setChatRound(0);
        entity.setErrorLogJson("[]");

        when(repo.findBySessionId("s16")).thenReturn(Optional.of(entity));

        assertThat(service.exists("s16")).isTrue();
        // Second call must use memory (no extra DB hit)
        verify(repo, atMost(2)).findBySessionId("s16");
    }

    // ── cefrLevel ─────────────────────────────────────────────────────────────

    @Test
    void updateCefrLevel_changesLevel() {
        service.getOrCreate("s17", "fr", "A1");
        service.updateCefrLevel("s17", "C2");

        assertThat(service.getCefrLevel("s17")).isEqualTo("C2");
    }

    @Test
    void getCefrLevel_unknownSession_returnsDefault() {
        assertThat(service.getCefrLevel("ghost")).isEqualTo("B1");
    }
}
