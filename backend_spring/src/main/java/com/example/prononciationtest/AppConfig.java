package com.example.prononciationtest;


import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

/**
 * Configuration Spring Boot.
 * - RestTemplate avec timeout adapté à Whisper (transcription peut prendre ~10s)
 * - ObjectMapper partagé avec support LocalDateTime (JavaTimeModule)
 */
@Configuration
public class AppConfig {

    @Bean
    public RestTemplate restTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5_000);
        factory.setReadTimeout(100_000); // 100s > 90s agent orTimeout — prevents TCP-level hang
        return new RestTemplate(factory);
    }

    /**
     * RestTemplate dédié au chatbot vocal.
     * Timeout étendu à 45 s car le pipeline LLM (LFM2.5) + TTS (edge-tts)
     * peut prendre jusqu'à ~30 s sur CPU.
     */
    @Bean
    @Qualifier("chatbotRestTemplate")
    public RestTemplate chatbotRestTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5_000);
        factory.setReadTimeout(90_000);   // 90s : Whisper base + LLM + TTS sur CPU
        return new RestTemplate(factory);
    }

    @Bean
    public ObjectMapper objectMapper() {
        return new ObjectMapper()
                .registerModule(new JavaTimeModule())
                .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    }
}