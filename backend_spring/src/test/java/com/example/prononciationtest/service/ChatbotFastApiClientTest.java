package com.example.prononciationtest.service;

import com.example.prononciationtest.service.dto.ChatSttResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChatbotFastApiClientTest {

    @Mock
    private RestTemplate restTemplate;

    private ChatbotFastApiClient client;

    @BeforeEach
    void setUp() {
        client = new ChatbotFastApiClient(restTemplate);
        ReflectionTestUtils.setField(client, "fastApiUrl", "http://localhost:8000");
    }

    @Test
    void chatStt_success_withNonNullFilename() throws IOException {
        MockMultipartFile file = new MockMultipartFile("audio", "test.webm", "audio/webm", "mock audio data".getBytes());
        ChatSttResponse mockResponse = new ChatSttResponse("Decoded transcription text");

        when(restTemplate.exchange(
            eq("http://localhost:8000/api/chat/stt"),
            eq(HttpMethod.POST),
            any(HttpEntity.class),
            eq(ChatSttResponse.class)
        )).thenReturn(new ResponseEntity<>(mockResponse, HttpStatus.OK));

        ChatSttResponse result = client.chatStt(file, "en");

        assertThat(result.text()).isEqualTo("Decoded transcription text");
    }

    @Test
    void chatStt_success_withNullFilename() throws IOException {
        MockMultipartFile file = new MockMultipartFile("audio", null, "audio/webm", "mock audio data".getBytes());
        ChatSttResponse mockResponse = new ChatSttResponse("Decoded text without file name");

        when(restTemplate.exchange(
            eq("http://localhost:8000/api/chat/stt"),
            eq(HttpMethod.POST),
            any(HttpEntity.class),
            eq(ChatSttResponse.class)
        )).thenReturn(new ResponseEntity<>(mockResponse, HttpStatus.OK));

        ChatSttResponse result = client.chatStt(file, null);

        assertThat(result.text()).isEqualTo("Decoded text without file name");
    }

    @Test
    void chatStt_nullResponseBody_throwsRuntimeException() throws IOException {
        MockMultipartFile file = new MockMultipartFile("audio", "a.webm", "audio/webm", "mock".getBytes());

        when(restTemplate.exchange(
            eq("http://localhost:8000/api/chat/stt"),
            eq(HttpMethod.POST),
            any(HttpEntity.class),
            eq(ChatSttResponse.class)
        )).thenReturn(new ResponseEntity<>(null, HttpStatus.OK));

        assertThatThrownBy(() -> client.chatStt(file, "fr"))
            .isInstanceOf(RuntimeException.class)
            .hasMessageContaining("returned null");
    }

    @Test
    void chatTts_success() {
        Map<String, String> bodyMap = new HashMap<>();
        bodyMap.put("audio_base64", "base64StringRepresentation");
        ResponseEntity<Map> responseEntity = new ResponseEntity<>(bodyMap, HttpStatus.OK);

        when(restTemplate.exchange(
            eq("http://localhost:8000/api/chat/tts"),
            eq(HttpMethod.POST),
            any(HttpEntity.class),
            eq(Map.class)
        )).thenReturn(responseEntity);

        String result = client.chatTts("Hello world", "en");

        assertThat(result).isEqualTo("base64StringRepresentation");
    }

    @Test
    void chatTts_nullResponseBody_returnsEmptyString() {
        ResponseEntity<Map> responseEntity = new ResponseEntity<>(null, HttpStatus.OK);

        when(restTemplate.exchange(
            eq("http://localhost:8000/api/chat/tts"),
            eq(HttpMethod.POST),
            any(HttpEntity.class),
            eq(Map.class)
        )).thenReturn(responseEntity);

        String result = client.chatTts("Hello world", null);

        assertThat(result).isEmpty();
    }

    @Test
    void chatTts_exception_throwsRuntimeException() {
        when(restTemplate.exchange(
            eq("http://localhost:8000/api/chat/tts"),
            eq(HttpMethod.POST),
            any(HttpEntity.class),
            eq(Map.class)
        )).thenThrow(new RuntimeException("Connection Timeout"));

        assertThatThrownBy(() -> client.chatTts("Hello world", "fr"))
            .isInstanceOf(RuntimeException.class)
            .hasMessageContaining("TTS proxy error");
    }
}
