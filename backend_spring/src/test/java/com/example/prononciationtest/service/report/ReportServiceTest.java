package com.example.prononciationtest.service.report;

import com.example.prononciationtest.service.ai.OllamaClientService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

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
    void testGenerateReportsAnalysis_CalculatesCorrectStatistics() {
        String mockResponse = "{\"avg_score\":80,\"best_score\":90}";
        when(ollamaClientService.callOllama(anyString(), anyString(), anyInt(), anyDouble()))
                .thenReturn(mockResponse);

        String result = reportService.generateReportsAnalysis("fr", "B2", List.of(70, 80, 90));
        assertEquals(mockResponse, result);
    }
}
