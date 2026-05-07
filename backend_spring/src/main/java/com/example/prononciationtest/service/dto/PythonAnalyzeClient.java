package com.example.prononciationtest.service.dto;

import com.example.prononciationtest.service.iservice.IPythonAnalyzeClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

@Service
public class PythonAnalyzeClient implements IPythonAnalyzeClient {

    @Value("${python.base-url:http://localhost:8000}")
    private String pythonBaseUrl;

    private final RestTemplate restTemplate;

    public PythonAnalyzeClient(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    @Override
    public PythonAnalyzeResponse analyze(MultipartFile audioFile,
                                         String expectedPhrase,
                                         String lang,
                                         String level) {
        try {
            MultiValueMap<String, Object> body = buildBody(audioFile, expectedPhrase, lang, level);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);

            ResponseEntity<PythonAnalyzeResponse> resp = restTemplate.exchange(
                    pythonBaseUrl + "/analyze",
                    HttpMethod.POST,
                    new HttpEntity<>(body, headers),
                    PythonAnalyzeResponse.class
            );

            if (resp.getBody() == null) {
                throw new RuntimeException("PYTHON_NULL_RESPONSE");
            }
            return resp.getBody();

        } catch (Exception e) {
            throw new RuntimeException("Python analyze error: " + e.getMessage(), e);
        }
    }

    @Override
    public boolean isHealthy() {
        try {
            return restTemplate
                    .getForEntity(pythonBaseUrl + "/health", String.class)
                    .getStatusCode().is2xxSuccessful();
        } catch (Exception e) {
            return false;
        }
    }

    private MultiValueMap<String, Object> buildBody(MultipartFile audioFile,
                                                     String expectedPhrase,
                                                     String lang,
                                                     String level) throws Exception {
        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("file", new ByteArrayResource(audioFile.getBytes()) {
            @Override
            public String getFilename() {
                return audioFile.getOriginalFilename() != null
                        ? audioFile.getOriginalFilename()
                        : "audio.wav";
            }
        });
        body.add("expectedPhrase", expectedPhrase);
        body.add("lang",  lang  != null ? lang  : "fr");
        body.add("level", level != null ? level : "B1");
        return body;
    }
}
