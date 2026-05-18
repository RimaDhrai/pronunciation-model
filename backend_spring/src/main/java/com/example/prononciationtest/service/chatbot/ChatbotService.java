package com.example.prononciationtest.service.chatbot;

import com.example.prononciationtest.service.ai.OllamaClientService;
import com.example.prononciationtest.service.ai.StreamService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

@Service
public class ChatbotService {

    private static final String REGEX_THINK = "(?i)<think>[\\s\\S]*?</think>";

    @Value("${ollama.model.chatbot:#{'qwen2.5:3b'}}")
    private String chatbotModel;

    private final ChatbotPromptBuilder promptBuilder;
    private final OllamaClientService ollamaClientService;
    private final StreamService streamService;

    public ChatbotService(ChatbotPromptBuilder promptBuilder,
                          OllamaClientService ollamaClientService,
                          StreamService streamService) {
        this.promptBuilder = promptBuilder;
        this.ollamaClientService = ollamaClientService;
        this.streamService = streamService;
    }

    public String generateChatbotResponse(
            List<Map<String, String>> history,
            String userText,
            List<String> weakWords,
            Double pronScore,
            String lang,
            String level,
            String scenario) {
        String system = promptBuilder.getChatbotSystemPrompt(lang, level, scenario);
        String content = promptBuilder.buildChatbotUserContent(userText, weakWords, pronScore, lang);
        List<Map<String, Object>> messages = promptBuilder.buildChatbotMessagesList(history, content, system);

        String raw = ollamaClientService.callOllamaMessages(chatbotModel, messages, 110, 0.65, 1024);
        String cleaned = raw.replaceAll(REGEX_THINK, "").trim();
        return cleaned.isBlank() ? raw.trim() : cleaned;
    }

    public String streamChatbotResponse(List<Map<String, Object>> messages, Consumer<String> onToken) {
        return streamService.streamChatbotResponse(messages, onToken);
    }
}
