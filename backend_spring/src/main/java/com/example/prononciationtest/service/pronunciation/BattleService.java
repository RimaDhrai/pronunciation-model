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
                ? "Génère UN paragraphe court et professionnel en français pour un exercice de prononciation compétitif chez Talan. " +
                        "Niveau " + level + ". Contexte : entreprise, IT, conseil. Pas de guillemets. Pas d'explication. Uniquement le texte."
                : "Generate ONE short professional paragraph in English for a competitive pronunciation drill at Talan. " +
                        "Level " + level + ". Context: corporate, IT, consulting. No quotes. No explanation. Just the text.";
        String prompt = "fr".equals(lang)
                ? "Un texte original, dynamique, de 15-25 mots, niveau " + level + "."
                : "An original, dynamic text, 15-25 words, level " + level + ".";
        
        String raw = ollamaClientService.callOllama(system, prompt, 60, 0.7);
        String cleaned = raw == null ? "" : raw.replaceAll("(^[\\\"'\\u00AB\\u00BB\\s]+)|([\\\"'\\u00AB\\u00BB\\s]+$)", "").trim();
        if (taxonomy.isHallucination(cleaned, lang)) {
            return taxonomy.getBattleFallback(lang, level);
        }
        return cleaned;
    }
}
