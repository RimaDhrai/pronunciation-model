package com.example.prononciationtest.service.pronunciation;

import com.example.prononciationtest.service.PhraseTaxonomy;
import com.example.prononciationtest.service.ai.OllamaClientService;
import org.springframework.stereotype.Service;

@Service
public class BattleService {

    private final OllamaClientService ollamaClientService;
    private final PhraseTaxonomy taxonomy;

    public BattleService(OllamaClientService ollamaClientService, PhraseTaxonomy taxonomy) {
        this.ollamaClientService = ollamaClientService;
        this.taxonomy = taxonomy;
    }

    public String generateBattlePhrase(String lang, String level) {
        String system = "fr".equals(lang)
                ? "G\u00e9n\u00e8re UNE seule phrase fran\u00e7aise pour un exercice de prononciation comp\u00e9titif. " +
                        "Niveau " + level + ". Pas de guillemets. Pas d'explication. Uniquement la phrase."
                : "Generate ONE English phrase for a competitive pronunciation drill. " +
                        "Level " + level + ". No quotes. No explanation. Just the phrase.";
        String prompt = "fr".equals(lang)
                ? "Une phrase originale, vivante, de 8-12 mots, niveau " + level + "."
                : "An original, lively phrase, 8-12 words, level " + level + ".";
        
        String raw = ollamaClientService.callOllama(system, prompt, 60, 0.7);
        String cleaned = raw == null ? "" : raw.replaceAll("(^[\\\"'\\u00AB\\u00BB\\s]+)|([\\\"'\\u00AB\\u00BB\\s]+$)", "").trim();
        if (taxonomy.isHallucination(cleaned, lang)) {
            return taxonomy.getBattleFallback(lang, level);
        }
        return cleaned;
    }
}
