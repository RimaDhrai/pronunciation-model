package com.example.prononciationtest.service.report;

import com.example.prononciationtest.service.ai.OllamaClientService;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ReportService {

    private final OllamaClientService ollamaClientService;

    public ReportService(OllamaClientService ollamaClientService) {
        this.ollamaClientService = ollamaClientService;
    }

    public String generateReportsAnalysis(String lang, String level, List<Integer> scores) {
        boolean fr = "fr".equals(lang);
        int avg = scores.isEmpty() ? 0 : (int) Math.round(scores.stream().mapToInt(i -> i).average().orElse(0));
        int best = scores.isEmpty() ? 0 : scores.stream().mapToInt(i -> i).max().orElse(0);

        String system = fr
                ? "Tu es un coach de prononciation. R\u00e9ponds UNIQUEMENT en JSON valide, rien d'autre."
                : "You are a pronunciation coach. Reply ONLY with valid JSON, nothing else.";

        String prompt;
        if (fr) {
            prompt = String.format("""
                    Voici les scores d'un apprenant niveau %s : %s.
                    Score moyen=%d/100, meilleur=%d/100.
                    G\u00e9n\u00e8re exactement ce JSON :
                    {"avg_score":%d,"best_score":%d,"trend":"...","tips":["conseil1","conseil2","conseil3"]}""",
                    level, scores, avg, best, avg, best);
        } else {
            prompt = String.format("""
                    Here are the scores of a level %s learner: %s.
                    Average=%d/100, best=%d/100.
                    Generate exactly this JSON:
                    {"avg_score":%d,"best_score":%d,"trend":"...","tips":["tip1","tip2","tip3"]}""",
                    level, scores, avg, best, avg, best);
        }

        return ollamaClientService.callOllama(system, prompt, 300, 0.5);
    }
}
