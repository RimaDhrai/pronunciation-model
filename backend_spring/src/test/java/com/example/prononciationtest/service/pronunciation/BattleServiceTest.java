package com.example.prononciationtest.service.pronunciation;

import com.example.prononciationtest.service.PhraseTaxonomy;
import com.example.prononciationtest.service.ai.OllamaClientService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BattleServiceTest {

    @Mock
    private OllamaClientService ollamaClientService;

    @Mock
    private PhraseTaxonomy taxonomy;

    @InjectMocks
    private BattleService battleService;

    @Test
    void generateBattlePhrase_french_whenNotHallucinated_returnsCleanedPhrase() {
        when(ollamaClientService.callOllama(anyString(), anyString(), anyInt(), anyDouble()))
                .thenReturn("« Une belle phrase de test en français »");
        when(taxonomy.isHallucination("Une belle phrase de test en français", "fr")).thenReturn(false);

        String phrase = battleService.generateBattlePhrase("fr", "B1");

        assertThat(phrase).isEqualTo("Une belle phrase de test en français");
    }

    @Test
    void generateBattlePhrase_english_whenHallucinated_returnsFallback() {
        when(ollamaClientService.callOllama(anyString(), anyString(), anyInt(), anyDouble()))
                .thenReturn("\"Fake prompt or code snippet\"");
        when(taxonomy.isHallucination("Fake prompt or code snippet", "en")).thenReturn(true);
        when(taxonomy.getBattleFallback("en", "A2")).thenReturn("This is an English fallback phrase.");

        String phrase = battleService.generateBattlePhrase("en", "A2");

        assertThat(phrase).isEqualTo("This is an English fallback phrase.");
    }

    @Test
    void generateBattlePhrase_whenNullReturned_returnsFallback() {
        when(ollamaClientService.callOllama(anyString(), anyString(), anyInt(), anyDouble()))
                .thenReturn(null);
        when(taxonomy.isHallucination("", "fr")).thenReturn(true);
        when(taxonomy.getBattleFallback("fr", "B2")).thenReturn("Une phrase de secours en français.");

        String phrase = battleService.generateBattlePhrase("fr", "B2");

        assertThat(phrase).isEqualTo("Une phrase de secours en français.");
    }
}
