package com.example.prononciationtest.controller;

import com.example.prononciationtest.entity.User;
import com.example.prononciationtest.repository.*;
import com.example.prononciationtest.service.iservice.IKeycloakAdminService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.lang.management.*;
import java.time.Instant;
import java.util.*;

@RestController
@CrossOrigin(origins = "http://localhost:8081")
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private static final Logger log = LoggerFactory.getLogger(AdminController.class);

    @Value("${ollama.model:#{'qwen2.5:7b'}}")
    private String ollamaModel;

    @Value("${ollama.model.chatbot:#{'qwen2.5:3b'}}")
    private String chatbotModel;

    @Value("${python.base-url:#{'http://localhost:8000'}}")
    private String pythonBaseUrl;

    private final UserRepository          userRepo;
    private final CEFRSessionRepository   cefrSessionRepo;
    private final CourseRepository        courseRepo;
    private final UserSessionRepository   userSessionRepo;
    private final IKeycloakAdminService   keycloakAdmin;

    // ── GET /api/admin/users — liste enrichie avec stats ────────────────────
    @GetMapping("/users")
    public ResponseEntity<?> getAllUsers() {
        List<User> users = userRepo.findAll();
        List<Map<String, Object>> result = new ArrayList<>();
        for (User u : users) {
            result.add(buildUserMap(u));
        }
        return ResponseEntity.ok(result);
    }

    // ── GET /api/admin/users/{id} ────────────────────────────────────────────
    @GetMapping("/users/{id}")
    public ResponseEntity<?> getUserById(@PathVariable Long id) {
        return userRepo.findById(id)
                .map(u -> ResponseEntity.ok(buildUserMap(u)))
                .orElse(ResponseEntity.notFound().build());
    }

    // ── POST /api/admin/users ────────────────────────────────────────────────
    @PostMapping("/users")
    public ResponseEntity<?> createUser(@RequestBody Map<String, Object> payload) {
        String email    = (String) payload.get("email");
        String fullName = (String) payload.get("fullName");
        String password = (String) payload.get("password");

        if (email == null || email.isBlank())
            return ResponseEntity.badRequest().body(Map.of("message", "Email requis"));
        if (password == null || password.isBlank())
            return ResponseEntity.badRequest().body(Map.of("message", "Mot de passe requis"));

        List<String> allowedDomains = List.of("esprit.tn", "talan.com", "gmail.com", "outlook.com", "yahoo.com", "hotmail.com");
        String emailLower = email.trim().toLowerCase();
        boolean domainOk = allowedDomains.stream().anyMatch(emailLower::endsWith);
        if (!domainOk)
            return ResponseEntity.badRequest().body(Map.of("message",
                "Domaine email non autorisé. Domaines acceptés : " + String.join(", ", allowedDomains)));

        try {
            keycloakAdmin.createUser(email.trim().toLowerCase(),
                    password, fullName != null ? fullName : email);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(409).body(Map.of("message", "Email déjà utilisé dans Keycloak"));
        } catch (Exception e) {
            return ResponseEntity.status(502).body(Map.of("message", "Erreur Keycloak : " + e.getMessage()));
        }

        User user = userRepo.findByEmail(email.trim().toLowerCase()).orElseGet(User::new);
        user.setEmail(email.trim().toLowerCase());
        user.setFullName(fullName);
        user.setEnabled(true);
        if (user.getPasswordHash() == null) user.setPasswordHash("keycloak");
        if (user.getCreatedAt() == null) user.setCreatedAt(Instant.now());
        userRepo.save(user);

        log.info("[Admin] Utilisateur créé : email={}", email);
        return ResponseEntity.ok(buildUserMap(user));
    }

    // ── DELETE /api/admin/users/{id} ─────────────────────────────────────────
    @DeleteMapping("/users/{id}")
    public ResponseEntity<?> deleteUser(@PathVariable Long id) {
        if (!userRepo.existsById(id)) return ResponseEntity.notFound().build();
        userRepo.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Utilisateur supprimé"));
    }

    // ── PUT /api/admin/users/{id} ────────────────────────────────────────────
    @PutMapping("/users/{id}")
    public ResponseEntity<?> updateUser(@PathVariable Long id,
                                        @RequestBody Map<String, Object> updates) {
        User user = userRepo.findById(id)
                .orElseThrow(() -> new RuntimeException("User introuvable"));

        if (updates.containsKey("fullName"))  user.setFullName((String) updates.get("fullName"));
        if (updates.containsKey("enabled"))   user.setEnabled((Boolean) updates.get("enabled"));
        if (updates.containsKey("cefrLevel")) user.setCefrLevel((String) updates.get("cefrLevel"));

        userRepo.save(user);
        return ResponseEntity.ok(buildUserMap(user));
    }

    // ── POST /api/admin/users/{id}/sync-keycloak ─────────────────────────────
    @PostMapping("/users/{id}/sync-keycloak")
    public ResponseEntity<?> syncToKeycloak(@PathVariable Long id,
                                             @RequestBody Map<String, String> body) {
        User user = userRepo.findById(id)
                .orElseThrow(() -> new RuntimeException("User introuvable"));

        String tempPassword = body.get("password");
        if (tempPassword == null || tempPassword.isBlank())
            return ResponseEntity.badRequest().body(Map.of("message", "Un mot de passe temporaire est requis"));

        try {
            keycloakAdmin.createUser(user.getEmail(), tempPassword,
                    user.getFullName() != null ? user.getFullName() : user.getEmail());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(409).body(Map.of("message", "Cet utilisateur existe déjà dans Keycloak"));
        } catch (Exception e) {
            return ResponseEntity.status(502).body(Map.of("message", "Erreur Keycloak : " + e.getMessage()));
        }

        return ResponseEntity.ok(Map.of("message", "Utilisateur synchronisé dans Keycloak avec succès", "email", user.getEmail()));
    }

    // ── GET /api/admin/stats — stats globales ────────────────────────────────
    @GetMapping("/stats")
    public ResponseEntity<?> getStats() {
        long totalCourses = courseRepo.count();
        long totalTests   = cefrSessionRepo.count();
        long completedTests = cefrSessionRepo.countByStatus("COMPLETED");

        List<User> allUsers = userRepo.findAll();
        long totalUsers = allUsers.size();

        // Répartition par niveau CEFR
        Map<String, Long> levelDist = new LinkedHashMap<>();
        for (String lvl : List.of("A1", "A2", "B1", "B2", "C1", "C2")) {
            levelDist.put(lvl, allUsers.stream()
                    .filter(u -> lvl.equalsIgnoreCase(u.getCefrLevel()))
                    .count());
        }

        // Top 5 utilisateurs par XP
        List<Map<String, Object>> topXp = allUsers.stream()
                .filter(u -> u.getTotalXp() != null && u.getTotalXp() > 0)
                .sorted(Comparator.comparingInt(u -> -u.getTotalXp()))
                .limit(5)
                .map(u -> Map.<String, Object>of(
                        "id", u.getId(),
                        "fullName", u.getFullName() != null ? u.getFullName() : u.getEmail(),
                        "xp", u.getTotalXp(),
                        "cefrLevel", u.getCefrLevel() != null ? u.getCefrLevel() : "—"
                ))
                .toList();

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("total_users",     totalUsers);
        stats.put("total_courses",   totalCourses);
        stats.put("total_tests",     totalTests);
        stats.put("completed_tests", completedTests);
        stats.put("level_distribution", levelDist);
        stats.put("top_xp_users",    topXp);
        return ResponseEntity.ok(stats);
    }

    // ── GET /api/admin/config — configuration courante de la plateforme ─────
    @GetMapping("/config")
    public ResponseEntity<?> getConfig() {
        Map<String, Object> cfg = new LinkedHashMap<>();
        cfg.put("ollama_model",         ollamaModel);
        cfg.put("ollama_model_chatbot",  chatbotModel);
        cfg.put("python_base_url",       pythonBaseUrl);
        cfg.put("spring_version",        org.springframework.boot.SpringApplication.class.getPackage().getImplementationVersion());
        cfg.put("java_version",          System.getProperty("java.version"));
        cfg.put("keycloak_realm",        "talan");
        cfg.put("database",              "PostgreSQL");
        return ResponseEntity.ok(cfg);
    }

    // ── GET /api/admin/jvm — métriques JVM en temps réel ────────────────────
    @GetMapping("/jvm")
    public ResponseEntity<?> getJvmMetrics() {
        Runtime rt = Runtime.getRuntime();
        long totalMb  = rt.totalMemory() / (1024 * 1024);
        long freeMb   = rt.freeMemory()  / (1024 * 1024);
        long usedMb   = totalMb - freeMb;
        long maxMb    = rt.maxMemory()   / (1024 * 1024);
        int  heapPct  = (int) (usedMb * 100 / Math.max(maxMb, 1));

        ThreadMXBean threads = ManagementFactory.getThreadMXBean();
        RuntimeMXBean runtimeMx = ManagementFactory.getRuntimeMXBean();

        long gcCollections = 0, gcTimeMs = 0;
        for (GarbageCollectorMXBean gc : ManagementFactory.getGarbageCollectorMXBeans()) {
            long cnt = gc.getCollectionCount();
            long t   = gc.getCollectionTime();
            if (cnt > 0) gcCollections += cnt;
            if (t   > 0) gcTimeMs      += t;
        }

        Map<String, Object> jvm = new LinkedHashMap<>();
        jvm.put("heap_used_mb",    usedMb);
        jvm.put("heap_free_mb",    freeMb);
        jvm.put("heap_total_mb",   totalMb);
        jvm.put("heap_max_mb",     maxMb);
        jvm.put("heap_percent",    heapPct);
        jvm.put("threads_live",    threads.getThreadCount());
        jvm.put("threads_peak",    threads.getPeakThreadCount());
        jvm.put("gc_collections",  gcCollections);
        jvm.put("gc_time_ms",      gcTimeMs);
        jvm.put("uptime_seconds",  runtimeMx.getUptime() / 1000);
        jvm.put("java_version",    System.getProperty("java.version"));
        jvm.put("os_name",         System.getProperty("os.name"));
        jvm.put("os_arch",         System.getProperty("os.arch"));
        jvm.put("available_cpus",  rt.availableProcessors());
        return ResponseEntity.ok(jvm);
    }

    // ── Helper : construit la map enrichie d'un utilisateur ──────────────────
    private Map<String, Object> buildUserMap(User u) {
        long cefrCount    = cefrSessionRepo.countByUserIdAndStatus(u.getId(), "COMPLETED");
        long exerciseCount = userSessionRepo.countByUserId(u.getId());

        // Badge calculé depuis XP
        int xp = u.getTotalXp() != null ? u.getTotalXp() : 0;
        String badge = xp >= 5000 ? "🏆 Expert"
                     : xp >= 2000 ? "🥇 Avancé"
                     : xp >= 800  ? "🥈 Intermédiaire"
                     : xp >= 200  ? "🥉 Débutant+"
                     : "🌱 Débutant";

        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id",            u.getId());
        m.put("email",         u.getEmail());
        m.put("fullName",      u.getFullName());
        m.put("enabled",       u.isEnabled());
        m.put("createdAt",     u.getCreatedAt() != null ? u.getCreatedAt().toString() : null);
        m.put("cefrLevel",     u.getCefrLevel());
        m.put("cefrCompleted", u.getCefrCompleted());
        m.put("totalXp",       xp);
        m.put("currentStreak", u.getCurrentStreak() != null ? u.getCurrentStreak() : 0);
        m.put("longestStreak", u.getLongestStreak() != null ? u.getLongestStreak() : 0);
        m.put("nativeLang",    u.getNativeLang());
        m.put("weakWords",     u.getWeakWords());
        m.put("badge",         badge);
        m.put("cefrTestCount", cefrCount);
        m.put("exerciseCount", exerciseCount);
        return m;
    }
}