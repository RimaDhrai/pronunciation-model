package com.example.prononciationtest.service.iservice;

import com.example.prononciationtest.service.dto.ChatSttResponse;
import org.springframework.web.multipart.MultipartFile;

/**
 * FastAPI bridge — Whisper STT + edge-TTS only.
 * LLM calls and session management are handled by Spring Boot (ChatbotAgent / OllamaService).
 */
public interface IChatbotFastApiClient {

    /**
     * STT — audio → Whisper transcription.
     * POST /api/chat/stt
     */
    ChatSttResponse chatStt(MultipartFile audio, String lang);

    /**
     * TTS — text → MP3 base64 via edge-tts.
     * POST /api/chat/tts
     */
    String chatTts(String text, String lang);
}
