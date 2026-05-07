package com.example.prononciationtest.service.iservice;

import com.example.prononciationtest.service.dto.EvaluationResponse;
import org.springframework.web.multipart.MultipartFile;

public interface IPracticeService {

    /**
     * Envoie l'audio à FastAPI, calcule les métriques et persiste la tentative.
     *
     * @param audioFile      fichier audio de l'utilisateur
     * @param expectedPhrase phrase attendue
     * @param lang           langue cible
     * @param level          niveau CEFR
     * @param username       identifiant de l'utilisateur (email ou sub)
     * @return               réponse d'évaluation complète
     */
    EvaluationResponse evaluate(MultipartFile audioFile,
                                String expectedPhrase,
                                String lang,
                                String level,
                                String username);
}
