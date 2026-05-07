package com.example.prononciationtest.service.iservice;

import com.example.prononciationtest.service.dto.PythonAnalyzeResponse;
import org.springframework.web.multipart.MultipartFile;

public interface IPythonAnalyzeClient {

    PythonAnalyzeResponse analyze(MultipartFile audioFile,
                                  String expectedPhrase,
                                  String lang,
                                  String level);

    boolean isHealthy();
}
