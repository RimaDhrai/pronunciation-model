package com.example.prononciationtest.service.chatbot;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class ChatbotPromptBuilderTest {

    private final ChatbotPromptBuilder promptBuilder = new ChatbotPromptBuilder();

    @Test
    void testGetChatbotSystemPrompt_DefaultScenario() {
        String promptFr = promptBuilder.getChatbotSystemPrompt("fr", "B1", "");
        assertTrue(promptFr.contains("coach de prononciation"));
        assertTrue(promptFr.contains("B1"));

        String promptEn = promptBuilder.getChatbotSystemPrompt("en", "A2", null);
        assertTrue(promptEn.contains("warm English pronunciation coach"));
        assertTrue(promptEn.contains("A2"));
    }

    @Test
    void testGetChatbotSystemPrompt_RoleplayScenario() {
        String customsPrompt = promptBuilder.getChatbotSystemPrompt("fr", "A2", "customs");
        assertTrue(customsPrompt.contains("douanier"));
        assertTrue(customsPrompt.contains("CDG"));
    }

    @Test
    void testBuildChatbotUserContent_NoWeakWordsNoScore() {
        String content = promptBuilder.buildChatbotUserContent("Hello", null, null, "en");
        assertEquals("Hello", content);
    }

    @Test
    void testBuildChatbotUserContent_Silence() {
        String content = promptBuilder.buildChatbotUserContent("", null, null, "en");
        assertTrue(content.contains("silence"));
    }

    @Test
    void testBuildChatbotUserContent_WithWeakWords() {
        String content = promptBuilder.buildChatbotUserContent("Hello", List.of("word1", "word2"), null, "fr");
        assertTrue(content.contains("Hello"));
        assertTrue(content.contains("Prononciation incertaine"));
        assertTrue(content.contains("\"word1\""));
    }

    @Test
    void testBuildChatbotUserContent_WithGoodScore() {
        String content = promptBuilder.buildChatbotUserContent("Hello", null, 0.85, "en");
        assertTrue(content.contains("Hello"));
        assertTrue(content.contains("Pronunciation score: 85%"));
    }

    @Test
    void testBuildChatbotMessagesList() {
        List<Map<String, String>> history = List.of(
                Map.of("role", "user", "content", "hi"),
                Map.of("role", "assistant", "content", "hello")
        );

        List<Map<String, Object>> messages = promptBuilder.buildChatbotMessagesList(history, "next user text", "system instruction");
        
        assertEquals(4, messages.size());
        assertEquals("system", messages.get(0).get("role"));
        assertEquals("system instruction", messages.get(0).get("content"));
        assertEquals("user", messages.get(1).get("role"));
        assertEquals("hi", messages.get(1).get("content"));
        assertEquals("user", messages.get(3).get("role"));
        assertEquals("next user text", messages.get(3).get("content"));
    }
}
