package com.example.prononciationtest.service.dto;

import java.time.LocalDateTime;

public record AttemptResponse(
        Long id,
        String expectedPhrase,
        String transcription,
        Integer score,
        Double wer,
        String feedback,
        String language,
        String level,
        LocalDateTime createdAt
) {}
