package com.example.prononciationtest.controller;

import com.example.prononciationtest.service.OllamaService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

/**
 * Mode Battle — deux utilisateurs prononcent la même phrase,
 * le meilleur score gagne. Stockage in-memory (TTL 30 min).
 */
@RestController
@RequestMapping("/api/battle")
@CrossOrigin(origins = "http://localhost:8081")
public class BattleController {

    private final OllamaService ollamaService;

    // ── Modèle de session battle ──────────────────────────────────────────────
    static class BattleSession {
        String code;
        String phrase;
        String lang;
        String level;
        String creatorEmail;
        String challengerEmail;
        Integer creatorScore;
        Integer challengerScore;
        String status;          // WAITING | ACTIVE | FINISHED
        LocalDateTime createdAt;

        BattleSession(String code, String phrase, String lang, String level, String creator) {
            this.code         = code;
            this.phrase       = phrase;
            this.lang         = lang;
            this.level        = level;
            this.creatorEmail = creator;
            this.status       = "WAITING";
            this.createdAt    = LocalDateTime.now();
        }

        Map<String, Object> toMap(String callerEmail) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("code",             code);
            m.put("phrase",           phrase);
            m.put("lang",             lang);
            m.put("level",            level);
            m.put("status",           status);
            m.put("creatorEmail",     creatorEmail);
            m.put("challengerEmail",  challengerEmail);
            m.put("creatorScore",     creatorScore);
            m.put("challengerScore",  challengerScore);
            m.put("isCreator",        creatorEmail != null && creatorEmail.equals(callerEmail));
            // Gagnant uniquement quand les deux ont soumis
            if ("FINISHED".equals(status) && creatorScore != null && challengerScore != null) {
                if (creatorScore > challengerScore)     m.put("winner", creatorEmail);
                else if (challengerScore > creatorScore) m.put("winner", challengerEmail);
                else                                    m.put("winner", "TIE");
            }
            return m;
        }
    }

    // ── Stockage in-memory + nettoyage automatique ────────────────────────────
    private final ConcurrentHashMap<String, BattleSession> battles = new ConcurrentHashMap<>();

    public BattleController(OllamaService ollamaService) {
        this.ollamaService = ollamaService;
        // Nettoyage toutes les 10 min — supprime les battles > 30 min
        Executors.newSingleThreadScheduledExecutor().scheduleAtFixedRate(
            () -> battles.values().removeIf(b ->
                b.createdAt.isBefore(LocalDateTime.now().minusMinutes(30))),
            10, 10, TimeUnit.MINUTES
        );
    }

    // ── POST /api/battle/create ───────────────────────────────────────────────
    @PostMapping("/create")
    public ResponseEntity<Map<String, Object>> create(
            @RequestBody Map<String, Object> req,
            Authentication auth) {

        String email = email(auth);
        String lang  = (String) req.getOrDefault("lang",  "fr");
        String level = (String) req.getOrDefault("level", "B1");

        // Génère une phrase via Ollama (courte, adaptée au niveau)
        String phrase = ollamaService.generateBattlePhrase(lang, level);
        String code   = randomCode();

        BattleSession battle = new BattleSession(code, phrase, lang, level, email);
        battles.put(code, battle);

        return ResponseEntity.ok(battle.toMap(email));
    }

    // ── POST /api/battle/join/{code} ──────────────────────────────────────────
    @PostMapping("/join/{code}")
    public ResponseEntity<Map<String, Object>> join(
            @PathVariable String code,
            Authentication auth) {

        String email = email(auth);
        BattleSession b = battles.get(code.toUpperCase());

        if (b == null)
            return ResponseEntity.status(404).body(Map.of("error", "Battle introuvable"));
        if (!"WAITING".equals(b.status))
            return ResponseEntity.status(409).body(Map.of("error", "Battle déjà en cours ou terminée"));
        if (email.equals(b.creatorEmail))
            return ResponseEntity.status(409).body(Map.of("error", "Tu es déjà le créateur de cette battle"));

        b.challengerEmail = email;
        b.status          = "ACTIVE";

        return ResponseEntity.ok(b.toMap(email));
    }

    // ── GET /api/battle/{code} — poll status ──────────────────────────────────
    @GetMapping("/{code}")
    public ResponseEntity<Map<String, Object>> status(
            @PathVariable String code,
            Authentication auth) {

        String email = email(auth);
        BattleSession b = battles.get(code.toUpperCase());
        if (b == null)
            return ResponseEntity.status(404).body(Map.of("error", "Battle introuvable"));
        return ResponseEntity.ok(b.toMap(email));
    }

    // ── POST /api/battle/{code}/submit ────────────────────────────────────────
    @PostMapping("/{code}/submit")
    public ResponseEntity<Map<String, Object>> submit(
            @PathVariable String code,
            @RequestBody Map<String, Object> req,
            Authentication auth) {

        String email = email(auth);
        int score = req.containsKey("score") ? ((Number) req.get("score")).intValue() : 0;

        BattleSession b = battles.get(code.toUpperCase());
        if (b == null)
            return ResponseEntity.status(404).body(Map.of("error", "Battle introuvable"));
        if ("WAITING".equals(b.status))
            return ResponseEntity.status(409).body(Map.of("error", "L'adversaire n'a pas encore rejoint"));

        if (email.equals(b.creatorEmail))    b.creatorScore    = score;
        else if (email.equals(b.challengerEmail)) b.challengerScore = score;
        else return ResponseEntity.status(403).body(Map.of("error", "Tu ne participes pas à cette battle"));

        // Finir si les deux ont soumis
        if (b.creatorScore != null && b.challengerScore != null)
            b.status = "FINISHED";

        return ResponseEntity.ok(b.toMap(email));
    }

    // ── GET /api/battle/my — battles actives de l'utilisateur ────────────────
    @GetMapping("/my")
    public ResponseEntity<List<Map<String, Object>>> myBattles(Authentication auth) {
        String email = email(auth);
        List<Map<String, Object>> mine = battles.values().stream()
                .filter(b -> email.equals(b.creatorEmail) || email.equals(b.challengerEmail))
                .filter(b -> !"FINISHED".equals(b.status))
                .map(b -> b.toMap(email))
                .toList();
        return ResponseEntity.ok(mine);
    }

    // ── DELETE /api/battle/{code} — nettoyage manuel ─────────────────────────
    @DeleteMapping("/{code}")
    public ResponseEntity<Map<String, Object>> delete(@PathVariable String code) {
        battles.remove(code.toUpperCase());
        return ResponseEntity.ok(Map.of("deleted", true));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    private String email(Authentication auth) {
        if (auth == null) throw new RuntimeException("Non authentifié");
        if (auth instanceof org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken jwt) {
            String e = jwt.getToken().getClaimAsString("email");
            if (e != null && !e.isBlank()) return e;
        }
        return auth.getName();
    }

    private String randomCode() {
        String chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        StringBuilder sb = new StringBuilder();
        Random rand = new Random();
        for (int i = 0; i < 6; i++) sb.append(chars.charAt(rand.nextInt(chars.length())));
        String code = sb.toString();
        return battles.containsKey(code) ? randomCode() : code;
    }
}
