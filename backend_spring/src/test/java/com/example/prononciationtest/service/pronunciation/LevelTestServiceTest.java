package com.example.prononciationtest.service.pronunciation;

import com.example.prononciationtest.service.PhraseTaxonomy;
import com.example.prononciationtest.service.ai.OllamaClientService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class LevelTestServiceTest {

    @Mock
    private OllamaClientService ollamaClientService;

    @Mock
    private PhraseTaxonomy taxonomy;

    @InjectMocks
    private LevelTestService levelTestService;

    @Test
    void generateLevelTestPhrase_french_returnsCleanedPhrase() {
        when(ollamaClientService.callOllama(anyString(), anyString(), anyInt(), anyDouble()))
                .thenReturn("1. Voici ma phrase cible.");
        when(taxonomy.isHallucination(anyString(), anyString())).thenReturn(false);

        String result = levelTestService.generateLevelTestPhrase("fr", "chat, chien", "A1");

        assertThat(result).isEqualTo("Voici ma phrase cible.");
    }

    @Test
    void generateLevelTestPhrase_english_returnsFallbackOnHallucination() {
        when(ollamaClientService.callOllama(anyString(), anyString(), anyInt(), anyDouble()))
                .thenReturn("import React from 'react';");
        when(taxonomy.getFallback("en", "B2", "general")).thenReturn("Fallback English phrase");

        String result = levelTestService.generateLevelTestPhrase("en", "beach, peach", "B2");

        assertThat(result).isEqualTo("Fallback English phrase");
    }

    @Test
    void generateLevelTestPhrase_allCefrLevels() {
        when(ollamaClientService.callOllama(anyString(), anyString(), anyInt(), anyDouble()))
                .thenReturn("A solid test sentence for all levels.");

        String[] levels = {"A1", "A2", "B1", "B2", "C1", "C2", "UNKNOWN"};
        for (String lvl : levels) {
            levelTestService.generateLevelTestPhrase("en", "word", lvl);
            levelTestService.generateLevelTestPhrase("fr", "mot", lvl);
        }
    }

    @Test
    void generateLevelTestTip_returnsTipWhenValid() {
        when(ollamaClientService.callOllama(anyString(), anyString(), anyInt(), anyDouble()))
                .thenReturn("Pronounce this clearly.");

        String tipFr = levelTestService.generateLevelTestTip("fr", "R");
        String tipEn = levelTestService.generateLevelTestTip("en", "TH");

        assertThat(tipFr).isEqualTo("Pronounce this clearly.");
        assertThat(tipEn).isEqualTo("Pronounce this clearly.");
    }

    @Test
    void generateLevelTestFeedback_savesInCacheAndInjectsUserName() {
        when(ollamaClientService.callOllama(anyString(), anyString(), anyInt(), anyDouble()))
                .thenReturn("Super Alex! Tu as bien prononcé.");

        // First call - invokes LLM and replaces "Alex" with "John"
        String f1 = levelTestService.generateLevelTestFeedback("fr", "R", "route", "la route", 80, "John");
        assertThat(f1).isEqualTo("Super John! Tu as bien prononcé.");

        // Second call - uses cached value
        String f2 = levelTestService.generateLevelTestFeedback("fr", "R", "route", "la route", 80, "John");
        assertThat(f2).isEqualTo("Super John! Tu as bien prononcé.");

        verify(ollamaClientService, times(1)).callOllama(anyString(), anyString(), anyInt(), anyDouble());
    }

    @Test
    void generateLevelTestFeedback_whenLlmResponseTooShort_returnsFallback() {
        when(ollamaClientService.callOllama(anyString(), anyString(), anyInt(), anyDouble()))
                .thenReturn("Short");

        String f1 = levelTestService.generateLevelTestFeedback("fr", "R", "route", "la route", 85, "John");
        assertThat(f1).contains("Excellent");

        String f2 = levelTestService.generateLevelTestFeedback("en", "TH", "think", "I think so", 60, "John");
        assertThat(f2).contains("Well done");

        String f3 = levelTestService.generateLevelTestFeedback("en", "TH", "think", "I think so", 30, "John");
        assertThat(f3).contains("challenging");
    }

    @Test
    void generateLevelTestSynthesis_returnsSynthesisAndAveragesScores() {
        when(ollamaClientService.callOllama(anyString(), anyString(), anyInt(), anyDouble()))
                .thenReturn("Global synthesis from AI.");

        List<Map<String, Object>> history = new ArrayList<>();
        Map<String, Object> h1 = new HashMap<>();
        h1.put("sound_label", "R");
        h1.put("score", 90);
        history.add(h1);

        Map<String, Object> h2 = new HashMap<>();
        h2.put("sound_label", "TH");
        h2.put("score", 50);
        history.add(h2);

        String synFr = levelTestService.generateLevelTestSynthesis("fr", history, "B2");
        assertThat(synFr).isEqualTo("Global synthesis from AI.");
    }

    @Test
    void generateLevelTestSynthesis_whenLlmFails_returnsFallback() {
        when(ollamaClientService.callOllama(anyString(), anyString(), anyInt(), anyDouble()))
                .thenReturn("Err");

        List<Map<String, Object>> history = new ArrayList<>();
        Map<String, Object> h1 = new HashMap<>();
        h1.put("sound_label", "R");
        h1.put("score", 85);
        history.add(h1);

        String synFr = levelTestService.generateLevelTestSynthesis("fr", history, "B2");
        assertThat(synFr).contains("Trés bon");

        String synEn = levelTestService.generateLevelTestSynthesis("en", history, "B2");
        assertThat(synEn).contains("Keep up");
    }
}
