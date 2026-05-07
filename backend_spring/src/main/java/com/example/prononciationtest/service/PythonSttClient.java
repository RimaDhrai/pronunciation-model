package com.example.prononciationtest.service;

import com.example.prononciationtest.service.iservice.IPythonSttClient;
import com.example.prononciationtest.service.dto.SttResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;

@Service
public class PythonSttClient implements IPythonSttClient {

    @Value("${python.stt.url:http://localhost:8000}")
    private String pythonBaseUrl;

    private final RestTemplate restTemplate;

    public PythonSttClient(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public SttResponse transcribe(File audioFile, String lang) throws IOException {
        byte[] bytes = Files.readAllBytes(audioFile.toPath());
        return transcribeBytes(bytes, audioFile.getName(), lang);
    }

    // ✅ Utilisé par PracticeService : transcribe(MultipartFile, lang)
    public SttResponse transcribe(MultipartFile audioFile, String lang) throws IOException {
        String name = audioFile.getOriginalFilename() != null
                ? audioFile.getOriginalFilename() : "audio.wav";
        return transcribeBytes(audioFile.getBytes(), name, lang);
    }

    private SttResponse transcribeBytes(byte[] bytes, String filename, String lang) {
        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("audio", new ByteArrayResource(bytes) {
            @Override
            public String getFilename() { return filename; }
        });
        body.add("lang", lang != null ? lang : "fr");

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);

        try {
            ResponseEntity<SttResponse> response = restTemplate.exchange(
                    pythonBaseUrl + "/api/chat/stt",
                    HttpMethod.POST,
                    new HttpEntity<>(body, headers),
                    SttResponse.class
            );
            SttResponse result = response.getBody();
            return result != null ? result : emptyResponse("PYTHON_NULL_RESPONSE");
        } catch (Exception e) {
            throw new RuntimeException("Erreur Whisper Python : " + e.getMessage(), e);
        }
    }

    public boolean isHealthy() {
        try {
            return restTemplate
                    .getForEntity(pythonBaseUrl + "/health", String.class)
                    .getStatusCode().is2xxSuccessful();
        } catch (Exception e) {
            return false;
        }
    }

    private SttResponse emptyResponse(String error) {
        SttResponse r = new SttResponse();
        r.setSilent(true);
        r.setError(error);
        r.setRawText("");
        r.setCleanText("");
        return r;
    }
}