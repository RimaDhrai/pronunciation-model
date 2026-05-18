package com.example.prononciationtest.service.report;

import com.example.prononciationtest.service.ai.OllamaClientService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

class ReportServiceTest {

    @Mock
    private OllamaClientService ollamaClientService;

    @InjectMocks
    private ReportService reportService;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
    }

    @Test
    void generateReportsAnalysis_French_withNonEmptyScores() {
        String mockResponse = "{\"avg_score\":80,\"best_score\":90}";
        when(ollamaClientService.callOllama(anyString(), anyString(), anyInt(), anyDouble()))
                .thenReturn(mockResponse);

        String result = reportService.generateReportsAnalysis("fr", "B2", List.of(70, 80, 90));
        assertEquals(mockResponse, result);
    }

    @Test
    void generateReportsAnalysis_French_withEmptyScores() {
        String mockResponse = "{\"avg_score\":0,\"best_score\":0}";
        when(ollamaClientService.callOllama(anyString(), anyString(), anyInt(), anyDouble()))
                .thenReturn(mockResponse);

        String result = reportService.generateReportsAnalysis("fr", "B2", Collections.emptyList());
        assertEquals(mockResponse, result);
    }

    @Test
    void generateReportsAnalysis_English_withNonEmptyScores() {
        String mockResponse = "{\"avg_score\":85,\"best_score\":95}";
        when(ollamaClientService.callOllama(anyString(), anyString(), anyInt(), anyDouble()))
                .thenReturn(mockResponse);

        String result = reportService.generateReportsAnalysis("en", "A2", List.of(80, 90, 95));
        assertEquals(mockResponse, result);
    }

    @Test
    void generateReportsAnalysis_English_withEmptyScores() {
        String mockResponse = "{\"avg_score\":0,\"best_score\":0}";
        when(ollamaClientService.callOllama(anyString(), anyString(), anyInt(), anyDouble()))
                .thenReturn(mockResponse);

        String result = reportService.generateReportsAnalysis("en", "A2", Collections.emptyList());
        assertEquals(mockResponse, result);
    }
}
