package com.example.prononciationtest.service.iservice;

import com.example.prononciationtest.service.dto.SttResponse;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;

public interface IPythonSttClient {

    /**
     * Transcrit un fichier audio depuis le disque via Whisper (FastAPI).
     *
     * @param audioFile fichier audio sauvegardé localement
     * @param lang      langue cible
     * @return réponse STT (transcription + confiance)
     */
    SttResponse transcribe(File audioFile, String lang) throws IOException;

    /**
     * Transcrit un MultipartFile reçu directement via HTTP.
     *
     * @param audioFile multipart audio
     * @param lang      langue cible
     * @return réponse STT
     */
    SttResponse transcribe(MultipartFile audioFile, String lang) throws IOException;

    /**
     * Vérifie que le service Python Whisper est joignable.
     *
     * @return {@code true} si le service répond en 2xx
     */
    boolean isHealthy();
}
