package com.example.prononciationtest.service.pronunciation;

import com.example.prononciationtest.service.PhraseTaxonomy;
import com.example.prononciationtest.service.ai.OllamaClientService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

class BattleServiceTest {

    @Mock
    private OllamaClientService ollamaClientService;

    @Mock
    private PhraseTaxonomy taxonomy;

    @InjectMocks
    private BattleService battleService;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
    }

    @Test
    void testGenerateBattlePhrase_Success() {
        when(ollamaClientService.callOllama(anyString(), anyString(), anyInt(), anyDouble()))
                .thenReturn("Phrase de combat !");
        when(taxonomy.isHallucination(anyString(), anyString())).thenReturn(false);

        String result = battleService.generateBattlePhrase("fr", "B1");
        assertEquals("Phrase de combat !", result);
    }

    @Test
    void testGenerateBattlePhrase_WithHallucination() {
        when(ollamaClientService.callOllama(anyString(), anyString(), anyInt(), anyDouble()))
                .thenReturn("Bad phrase");
        when(taxonomy.isHallucination("Bad phrase", "en")).thenReturn(true);
        when(taxonomy.getBattleFallback("en", "A1")).thenReturn("Short fallback");

        String result = battleService.generateBattlePhrase("en", "A1");
        assertEquals("Short fallback", result);
    }
}
