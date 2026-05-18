package com.example.prononciationtest.service;

import com.example.prononciationtest.service.dto.SttResponse;
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

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PythonSttClientTest {

    @Mock
    private RestTemplate restTemplate;

    private PythonSttClient client;

    @BeforeEach
    void setUp() {
        client = new PythonSttClient(restTemplate);
        ReflectionTestUtils.setField(client, "pythonBaseUrl", "http://localhost:8000");
    }

    @Test
    void transcribe_multipartFile_success() throws IOException {
        MockMultipartFile file = new MockMultipartFile("audio", "audio.wav", "audio/wav", "dummy-bytes".getBytes());
        SttResponse responseBody = new SttResponse();
        responseBody.setCleanText("Transcribed text");

        when(restTemplate.exchange(
            eq("http://localhost:8000/api/chat/stt"),
            eq(HttpMethod.POST),
            any(HttpEntity.class),
            eq(SttResponse.class)
        )).thenReturn(new ResponseEntity<>(responseBody, HttpStatus.OK));

        SttResponse result = client.transcribe(file, "en");

        assertThat(result.getCleanText()).isEqualTo("Transcribed text");
    }

    @Test
    void transcribe_file_success() throws IOException {
        File tempFile = File.createTempFile("test-audio", ".wav");
        tempFile.deleteOnExit();
        Files.write(tempFile.toPath(), "dummy-file-bytes".getBytes());

        SttResponse responseBody = new SttResponse();
        responseBody.setCleanText("Transcribed from file");

        when(restTemplate.exchange(
            eq("http://localhost:8000/api/chat/stt"),
            eq(HttpMethod.POST),
            any(HttpEntity.class),
            eq(SttResponse.class)
        )).thenReturn(new ResponseEntity<>(responseBody, HttpStatus.OK));

        SttResponse result = client.transcribe(tempFile, "fr");

        assertThat(result.getCleanText()).isEqualTo("Transcribed from file");
    }

    @Test
    void transcribe_multipartFile_withNullFilename() throws IOException {
        MockMultipartFile file = new MockMultipartFile("audio", null, "audio/wav", "dummy-bytes".getBytes());
        SttResponse responseBody = new SttResponse();
        responseBody.setCleanText("No filename text");

        when(restTemplate.exchange(
            eq("http://localhost:8000/api/chat/stt"),
            eq(HttpMethod.POST),
            any(HttpEntity.class),
            eq(SttResponse.class)
        )).thenReturn(new ResponseEntity<>(responseBody, HttpStatus.OK));

        SttResponse result = client.transcribe(file, null);

        assertThat(result.getCleanText()).isEqualTo("No filename text");
    }

    @Test
    void transcribe_nullResponseBody_returnsEmptyResponse() throws IOException {
        MockMultipartFile file = new MockMultipartFile("audio", "a.wav", "audio/wav", "mock".getBytes());

        when(restTemplate.exchange(
            eq("http://localhost:8000/api/chat/stt"),
            eq(HttpMethod.POST),
            any(HttpEntity.class),
            eq(SttResponse.class)
        )).thenReturn(new ResponseEntity<>(null, HttpStatus.OK));

        SttResponse result = client.transcribe(file, "fr");

        assertThat(result.getError()).isEqualTo("PYTHON_NULL_RESPONSE");
        assertThat(result.isSilent()).isTrue();
    }

    @Test
    void transcribe_exception_throwsRuntimeException() {
        MockMultipartFile file = new MockMultipartFile("audio", "a.wav", "audio/wav", "mock".getBytes());

        when(restTemplate.exchange(
            eq("http://localhost:8000/api/chat/stt"),
            eq(HttpMethod.POST),
            any(HttpEntity.class),
            eq(SttResponse.class)
        )).thenThrow(new RuntimeException("Connection Refused"));

        assertThatThrownBy(() -> client.transcribe(file, "fr"))
            .isInstanceOf(RuntimeException.class)
            .hasMessageContaining("Erreur Whisper Python");
    }

    @Test
    void isHealthy_healthy_returnsTrue() {
        ResponseEntity<String> response = new ResponseEntity<>("ok", HttpStatus.OK);
        when(restTemplate.getForEntity("http://localhost:8000/health", String.class))
            .thenReturn(response);

        assertThat(client.isHealthy()).isTrue();
    }

    @Test
    void isHealthy_unhealthy_returnsFalse() {
        when(restTemplate.getForEntity("http://localhost:8000/health", String.class))
            .thenThrow(new RuntimeException("Down"));

        assertThat(client.isHealthy()).isFalse();
    }
}
