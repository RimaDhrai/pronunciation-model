package com.example.prononciationtest.service.chatbot;

import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class ChatbotPromptBuilder {

    private static final String KEY_CONTENT = "content";

    public String getChatbotSystemPrompt(String lang, String level, String scenario) {
        return (scenario != null && !scenario.isBlank())
                ? buildRoleplaySystemPrompt(lang, level, scenario)
                : buildChatbotSystemPrompt(lang, level);
    }

    public String buildChatbotUserContent(String userText, List<String> weakWords, Double pronScore, String lang) {
        String content = (userText == null || userText.isBlank())
                ? "(silence — encourage user to speak)"
                : userText;
        if (weakWords != null && !weakWords.isEmpty()) {
            String hint = weakWords.stream()
                    .map(w -> "\"" + w + "\"")
                    .collect(java.util.stream.Collectors.joining(", "));
            content += switch (lang) {
                case "en" -> "\n[Uncertain pronunciation: " + hint + "]";
                case "es" -> "\n[Pronunciaci\u00f3n incierta: " + hint + "]";
                case "de" -> "\n[Unsichere Aussprache: " + hint + "]";
                default -> "\n[Prononciation incertaine: " + hint + "]";
            };
        } else if (pronScore != null && pronScore >= 0.80) {
            int pct = (int) (pronScore * 100);
            content += switch (lang) {
                case "en" -> "\n[Pronunciation score: " + pct + "% — very good!]";
                case "es" -> "\n[Puntuaci\u00f3n: " + pct + "% — \u00a1muy bien!]";
                case "de" -> "\n[Aussprache-Score: " + pct + "% — sehr gut!]";
                default -> "\n[Score prononciation: " + pct + "% — tr\u00e8s bon !]";
            };
        }
        return content;
    }

    public List<Map<String, Object>> buildChatbotMessagesList(
            List<Map<String, String>> history, String userContent, String systemPrompt) {
        List<Map<String, Object>> messages = new ArrayList<>();
        messages.add(Map.of("role", "system", KEY_CONTENT, systemPrompt));
        if (history != null) {
            int start = Math.max(0, history.size() - 4);
            for (Map<String, String> h : history.subList(start, history.size())) {
                messages.add(Map.of("role", h.get("role"), KEY_CONTENT, h.get(KEY_CONTENT)));
            }
        }
        messages.add(Map.of("role", "user", KEY_CONTENT, userContent));
        return messages;
    }

    private String buildRoleplaySystemPrompt(String lang, String level, String scenario) {
        boolean fr = !"en".equals(lang);
        String levelHint = fr ? switch (level) {
            case "A1" -> "utilise des phrases tr\u00e8s simples (max 8 mots)";
            case "A2" -> "utilise des phrases simples et courtes";
            case "B1" -> "utilise un langage courant, clair";
            case "B2" -> "utilise un langage naturel et vari\u00e9";
            default -> "utilise un langage riche et naturel";
        } : switch (level) {
            case "A1" -> "use very short simple sentences (max 8 words)";
            case "A2" -> "use simple and short sentences";
            case "B1" -> "use everyday clear language";
            case "B2" -> "use natural and varied language";
            default -> "use rich and natural language";
        };

        return switch (scenario) {
            case "customs" -> fr
                    ? ("Tu es douanier a l'aeroport CDG. %s. Max 2 phrases. Verifie passeport, duree du sejour, bagages. Si [Prononciation incertaine: X] : corrige le mot X dans le role et ajoute [REPETE: \"phrase courte avec X\"]. Ne repete pas la meme phrase que l'apprenant. Avance le scenario.")
                            .formatted(levelHint)
                    : ("You are a border control officer at Heathrow. %s. Max 2 sentences. Check passport, duration of stay, luggage. If [Uncertain pronunciation: X] : correct X in character then add [REPEAT: \"short phrase with X\"]. Never repeat the learner's sentence. Advance the scenario.")
                            .formatted(levelHint);
            case "interview" -> fr
                    ? ("Tu es manager RH en entretien d'embauche. %s. Max 2 phrases. Questions sur parcours, motivation, competences. Si [Prononciation incertaine: X] : corrige X discretement puis ajoute [REPETE: \"phrase courte avec X\"]. Jamais la meme phrase que l'apprenant. Avance l'entretien.")
                            .formatted(levelHint)
                    : ("You are a hiring manager conducting a job interview. %s. Max 2 sentences. Ask about background, motivation, skills. If [Uncertain pronunciation: X] : correct X subtly then add [REPEAT: \"short phrase with X\"]. Never repeat the learner's sentence. Advance the interview.")
                            .formatted(levelHint);
            case "restaurant" -> fr
                    ? ("Tu es serveur dans un restaurant parisien elegant. %s. Max 2 phrases. Guide : accueil -> carte -> commande -> addition. Si [Prononciation incertaine: X] : corrige X naturellement puis ajoute [REPETE: \"phrase courte avec X\"]. Ne repete pas la phrase de l'apprenant.")
                            .formatted(levelHint)
                    : ("You are a waiter at a London restaurant. %s. Max 2 sentences. Guide: welcome -> menu -> order -> bill. If [Uncertain pronunciation: X] : correct X naturally then add [REPEAT: \"short phrase with X\"]. Never repeat the learner's sentence.")
                            .formatted(levelHint);
            default -> buildChatbotSystemPrompt(lang, level);
        };
    }

    private String buildChatbotSystemPrompt(String lang, String level) {
        return switch (lang) {
            case "en" ->
                """
                        You are a warm English pronunciation coach. Learner level: %s.
                        STYLE: have a real conversation - ask questions, react naturally, change topics.
                        ABSOLUTE RULE: Never repeat the learner's message word for word.
                        CORRECTION: If [Uncertain pronunciation: X] appears, correct X then add [REPEAT: "3-5 NEW words containing X"]. The [REPEAT] phrase must be DIFFERENT from all previous ones. Never write "Repeat after me" in plain text.
                        NO ERROR: pure conversation, no [REPEAT] tag.
                        NEVER two [REPEAT] in a row. Max 2 sentences. No <think>. Friendly tone.
                        """
                        .formatted(level);
            case "es" ->
                """
                        Eres un coach certificado de pronunciaci\u00f3n. Nivel MCER: %s.
                        ESTILO: profesional, alentador, usa IPA cuando ayude (/r/ vibrante, /x/ jota, /d/ entre vocales).
                        FORMATO (2-3 frases): 1) Reacciona al tema. 2) Si [Pronunciaci\u00f3n incierta: X]: IPA + posici\u00f3n articulatoria. Si score>=80: elogio espec\u00edfico. 3) Una pregunta de seguimiento.
                        REGLAS: Nunca escribas <think>. Adapta al nivel %s.
                        """
                        .formatted(level, level);
            case "de" ->
                """
                        Du bist ein zertifizierter Aussprachecoach. Niveau: %s.
                        STIL: professionell, ermutigend, IPA wenn hilfreich (/R/ Z\u00e4pfchen-R, /ch/ ich-Laut, /y/ kurzes \u00fc).
                        FORMAT (2-3 S\u00e4tze): 1) Auf Thema eingehen. 2) Bei [Unsichere Aussprache: X]: IPA + Artikulationshinweis. Bei Score>=80: spezifisches Lob. 3) Eine Folgefrage.
                        REGELN: Kein <think>. Niveau %s anpassen.
                        """
                        .formatted(level, level);
            default ->
                """
                        Tu es un coach de prononciation fran\u00e7aise sympathique. Niveau apprenant : %s.
                        STYLE : mene une vraie conversation - pose des questions, reagis, change de sujet naturellement.
                        REGLE ABSOLUE : Ne repete JAMAIS le message de l'apprenant mot pour mot.
                        CORRECTION : Si [Prononciation incertaine: X] apparait, reponds en corrigeant X puis ajoute [REPETE: "3-5 mots NOUVEAUX contenant X"]. La phrase [REPETE] doit etre differente de toutes les phrases precedentes. Ne dis pas "Repete apres moi" en texte brut.
                        SANS ERREUR : conversation pure, sans balise [REPETE].
                        JAMAIS deux [REPETE] de suite. Max 2 phrases. Pas de <think>. Ton chaleureux.
                        """
                        .formatted(level);
        };
    }
}
