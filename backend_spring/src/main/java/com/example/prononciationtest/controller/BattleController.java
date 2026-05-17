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

    static final int TOTAL_ROUNDS = 3;
    private static final String STATUS_FINISHED = "FINISHED";
    private static final String KEY_WINNER = "winner";

    // ── Modèle de session battle ──────────────────────────────────────────────
    static class BattleSession {
        String code;
        List<String> phrases;
        String lang;
        String level;
        String creatorEmail;
        String challengerEmail;
        List<Integer> creatorScores     = new ArrayList<>();
        List<Integer> challengerScores  = new ArrayList<>();
        String status;          // WAITING | ACTIVE | FINISHED
        LocalDateTime createdAt;

        BattleSession(String code, List<String> phrases, String lang, String level, String creator) {
            this.code         = code;
            this.phrases      = phrases;
            this.lang         = lang;
            this.level        = level;
            this.creatorEmail = creator;
            this.status       = "WAITING";
            this.createdAt    = LocalDateTime.now();
        }

        Map<String, Object> toMap(String callerEmail) {
            boolean isCreator  = creatorEmail != null && creatorEmail.equals(callerEmail);
            int callerRound    = isCreator ? creatorScores.size() : challengerScores.size();
            int creatorTotal   = creatorScores.stream().mapToInt(Integer::intValue).sum();
            int challengerTotal= challengerScores.stream().mapToInt(Integer::intValue).sum();

            Map<String, Object> m = new LinkedHashMap<>();
            m.put("code",                      code);
            m.put("phrase",                    callerRound < phrases.size() ? phrases.get(callerRound) : phrases.get(phrases.size()-1));
            m.put("phrases",                   phrases);
            m.put("round",                     callerRound + 1);
            m.put("totalRounds",               TOTAL_ROUNDS);
            m.put("lang",                      lang);
            m.put("level",                     level);
            m.put("status",                    status);
            m.put("creatorEmail",              creatorEmail);
            m.put("challengerEmail",           challengerEmail);
            m.put("creatorScore",              creatorTotal);
            m.put("challengerScore",           challengerTotal);
            m.put("creatorRoundScores",        creatorScores);
            m.put("challengerRoundScores",     challengerScores);
            m.put("creatorRoundsCompleted",    creatorScores.size());
            m.put("challengerRoundsCompleted", challengerScores.size());
            m.put("isCreator",                 isCreator);
            if (STATUS_FINISHED.equals(status)) {
                if (creatorTotal > challengerTotal)      m.put(KEY_WINNER, creatorEmail);
                else if (challengerTotal > creatorTotal) m.put(KEY_WINNER, challengerEmail);
                else                                     m.put(KEY_WINNER, "TIE");
            }
            return m;
        }
    }

    // ── Stockage in-memory + nettoyage automatique ────────────────────────────
    private final ConcurrentHashMap<String, BattleSession> battles = new ConcurrentHashMap<>();
    private final java.util.concurrent.ScheduledExecutorService scheduler = java.util.concurrent.Executors.newSingleThreadScheduledExecutor();
    private final Random rand = new Random();

    public BattleController(OllamaService ollamaService) {
        this.ollamaService = ollamaService;
        // Nettoyage toutes les 10 min — supprime les battles > 30 min
        scheduler.scheduleAtFixedRate(
            () -> battles.values().removeIf(b ->
                b.createdAt.isBefore(LocalDateTime.now().minusMinutes(30))),
            10, 10, TimeUnit.MINUTES
        );
    }

    @jakarta.annotation.PreDestroy
    public void shutdown() {
        scheduler.shutdown();
    }

    // ── POST /api/battle/create ───────────────────────────────────────────────
    @PostMapping("/create")
    public ResponseEntity<Map<String, Object>> create(
            @RequestBody Map<String, Object> req,
            Authentication auth) {

        String email = email(auth);
        String lang  = (String) req.getOrDefault("lang",  "fr");
        String level = (String) req.getOrDefault("level", "B1");

        // Génère 5 phrases via Ollama
        List<String> phrases = new ArrayList<>();
        for (int i = 0; i < TOTAL_ROUNDS; i++)
            phrases.add(ollamaService.generateBattlePhrase(lang, level));
        String code = randomCode();

        BattleSession battle = new BattleSession(code, phrases, lang, level, email);
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

        if (email.equals(b.creatorEmail)) {
            if (b.creatorScores.size() < TOTAL_ROUNDS) b.creatorScores.add(score);
        } else if (email.equals(b.challengerEmail)) {
            if (b.challengerScores.size() < TOTAL_ROUNDS) b.challengerScores.add(score);
        } else return ResponseEntity.status(403).body(Map.of("error", "Tu ne participes pas à cette battle"));

        // Finir quand les deux ont soumis les 5 rounds
        if (b.creatorScores.size() >= TOTAL_ROUNDS && b.challengerScores.size() >= TOTAL_ROUNDS)
            b.status = STATUS_FINISHED;

        return ResponseEntity.ok(b.toMap(email));
    }

    // ── GET /api/battle/my — battles actives de l'utilisateur ────────────────
    @GetMapping("/my")
    public ResponseEntity<List<Map<String, Object>>> myBattles(Authentication auth) {
        String email = email(auth);
        List<Map<String, Object>> mine = battles.values().stream()
                .filter(b -> email.equals(b.creatorEmail) || email.equals(b.challengerEmail))
                .filter(b -> !STATUS_FINISHED.equals(b.status))
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
        for (int i = 0; i < 6; i++) sb.append(chars.charAt(rand.nextInt(chars.length())));
        String code = sb.toString();
        return battles.containsKey(code) ? randomCode() : code;
    }
}
