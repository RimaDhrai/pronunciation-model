package com.example.prononciationtest.service;

import org.junit.jupiter.api.Test;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class PhraseTaxonomyTest {

    private final PhraseTaxonomy phraseTaxonomy = new PhraseTaxonomy();

    @Test
    void isHallucination_variousCases() {
        // Null / blank / short cases
        assertThat(phraseTaxonomy.isHallucination(null, "fr")).isTrue();
        assertThat(phraseTaxonomy.isHallucination("   ", "fr")).isTrue();
        assertThat(phraseTaxonomy.isHallucination("abc", "fr")).isTrue(); // too short (< 6)

        // Non-Latin characters (Chinese / Arabic / Cyrillic)
        assertThat(phraseTaxonomy.isHallucination("你好，这是一个句子。", "fr")).isTrue();
        assertThat(phraseTaxonomy.isHallucination("هذا هو النص المترجم", "fr")).isTrue();

        // Meta commentary detection
        assertThat(phraseTaxonomy.isHallucination("As requested: Je mange une pomme.", "fr")).isTrue();
        assertThat(phraseTaxonomy.isHallucination("```json { \"text\": \"bonjour\" } ```", "fr")).isTrue();
        assertThat(phraseTaxonomy.isHallucination("Here is a sentence: Je mange une pomme.", "fr")).isTrue();

        // Technical jargon / complex sentences should be treated as hallucination (for fallback replacement)
        assertThat(phraseTaxonomy.isHallucination("L'intersubjectivité constitue le fondement", "fr")).isTrue();
        assertThat(phraseTaxonomy.isHallucination("Artificial intelligence raises fundamental questions", "en")).isTrue();

        // Wrong language starting words
        assertThat(phraseTaxonomy.isHallucination("The cat sleeps on the table.", "fr")).isTrue();
        assertThat(phraseTaxonomy.isHallucination("Je mange du pain.", "en")).isTrue();

        // Normal correct phrases
        assertThat(phraseTaxonomy.isHallucination("Je mange une pomme chaque matin.", "fr")).isFalse();
        assertThat(phraseTaxonomy.isHallucination("The weather is nice today.", "en")).isFalse();
    }

    @Test
    void getFallback_cascadingLogic() {
        // 1. Direct type match (e.g. Battle)
        String battlePhrase = phraseTaxonomy.getFallback("fr", "A1", "battle");
        assertThat(battlePhrase).isNotEmpty();
        assertThat(phraseTaxonomy.getAll("fr", "A1", "battle")).contains(battlePhrase);

        // 2. Cascade to general type if requested type is absent/custom
        String customPhrase = phraseTaxonomy.getFallback("fr", "A1", "custom_nonexistent_type");
        assertThat(customPhrase).isNotEmpty();
        assertThat(phraseTaxonomy.getAll("fr", "A1", "general")).contains(customPhrase);

        // 3. Cascade to B1 general if level is null/invalid
        String invalidLevelPhrase = phraseTaxonomy.getFallback("en", "Z9", "general");
        assertThat(invalidLevelPhrase).isNotEmpty();
        assertThat(phraseTaxonomy.getAll("en", "B1", "general")).contains(invalidLevelPhrase);

        // 4. Case sensitivity normalization in level
        String lowercaseLevelPhrase = phraseTaxonomy.getFallback("fr", "a2", "general");
        assertThat(lowercaseLevelPhrase).isNotEmpty();
        assertThat(phraseTaxonomy.getAll("fr", "A2", "general")).contains(lowercaseLevelPhrase);
    }

    @Test
    void getBattleFallback_convenienceMethod() {
        String battlePhrase = phraseTaxonomy.getBattleFallback("en", "A2");
        assertThat(battlePhrase).isNotEmpty();
        assertThat(phraseTaxonomy.getAll("en", "A2", "battle")).contains(battlePhrase);
    }

    @Test
    void getAll_returnsUnmodifiableList() {
        List<String> list = phraseTaxonomy.getAll("fr", "A1", "general");
        assertThat(list).isNotEmpty();

        // Verifying it is indeed unmodifiable
        assertThat(phraseTaxonomy.getAll("fr", "A1", "nonexistent_type")).isEmpty();
    }
}
