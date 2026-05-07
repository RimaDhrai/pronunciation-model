package com.example.prononciationtest.controller;

import com.example.prononciationtest.entity.Badge;
import com.example.prononciationtest.entity.User;
import com.example.prononciationtest.entity.UserSession;
import com.example.prononciationtest.repository.BadgeRepository;
import com.example.prononciationtest.repository.CEFRSessionRepository;
import com.example.prononciationtest.repository.UserRepository;
import com.example.prononciationtest.repository.UserSessionRepository;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;


@RestController
@RequestMapping("/api/user")
@CrossOrigin(origins = "http://localhost:8081")
@RequiredArgsConstructor

public class UserController {

    private final UserRepository userRepository;
    private final UserSessionRepository userSessionRepository;
    private final PasswordEncoder passwordEncoder;
    private final BadgeRepository badgeRepository;
    private final CEFRSessionRepository cefrSessionRepository;

    public record UpdateProfile(String fullName, String jobTitle, String nativeLang) {}
    public record UpdatePassword(String oldPassword, String newPassword) {}
    public record ProgressUpdate(
        @JsonProperty("cefr_level")     String  cefrLevel,
        @JsonProperty("cefr_completed") Boolean cefrCompleted
    ) {}


    /**
     * Resolves the authenticated user's e-mail from a Keycloak JwtAuthenticationToken.
     * Keycloak embeds the e-mail in the "email" JWT claim.
     * Falls back to auth.getName() (the "sub" / preferred_username value) when
     * the claim is absent so the code stays robust during local development.
     */
    private String currentEmail(Authentication authentication) {
        if (authentication == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Not authenticated");
        }
        if (authentication instanceof JwtAuthenticationToken jwtAuth) {
            String email = jwtAuth.getToken().getClaimAsString("email");
            if (email != null && !email.isBlank()) {
                return email;
            }
        }
        String name = authentication.getName();
        if (name == null || name.isBlank() || "anonymousUser".equals(name)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Not authenticated");
        }
        return name;
    }

    @GetMapping("/me")
    public Map<String, Object> me(Authentication authentication) {
        String email = currentEmail(authentication);
        User user = userRepository.findByEmail(email)
                .orElseGet(() -> autoProvisionUser(authentication, email));

        List<Badge> badges = badgeRepository.findByUserId(user.getId());

        // Self-heal: if DB flag is stale but a COMPLETED session exists, fix it now
        boolean cefrCompleted = Boolean.TRUE.equals(user.getCefrCompleted());
        if (!cefrCompleted && cefrSessionRepository.existsByUserIdAndStatus(user.getId(), "COMPLETED")) {
            cefrCompleted = true;
            user.setCefrCompleted(true);
            userRepository.save(user);
        }

        Map<String, Object> response = new HashMap<>();
        response.put("id",             user.getId());
        response.put("email",          user.getEmail());
        response.put("fullName",        user.getFullName());
        response.put("enabled",         user.isEnabled());
        response.put("cefrLevel",       user.getCefrLevel());
        response.put("cefrCompleted",   cefrCompleted);
        response.put("jobTitle",        user.getJobTitle());
        response.put("nativeLang",      user.getNativeLang());
        response.put("totalXp",         user.getTotalXp());
        response.put("currentStreak",   user.getCurrentStreak());
        response.put("longestStreak",   user.getLongestStreak());
        response.put("lastActivityDate", user.getLastActivityDate() != null ? user.getLastActivityDate().toString() : null);
        response.put("badges",          badges);
        return response;
    }

    /**
     * Auto-crée un utilisateur local à la première connexion Keycloak.
     * Couvre : utilisateurs créés manuellement dans Keycloak, utilisateurs LDAP.
     */
    private User autoProvisionUser(Authentication authentication, String email) {
        User u = new User();
        u.setEmail(email);
        u.setPasswordHash("KC_MANAGED");
        u.setCreatedAt(Instant.now());
        u.setEnabled(true);

        if (authentication instanceof JwtAuthenticationToken jwtAuth) {
            String fullName = jwtAuth.getToken().getClaimAsString("name");
            if (fullName == null || fullName.isBlank()) {
                String first = jwtAuth.getToken().getClaimAsString("given_name");
                String last  = jwtAuth.getToken().getClaimAsString("family_name");
                fullName = ((first != null ? first : "") + " " + (last != null ? last : "")).trim();
            }
            if (!fullName.isBlank()) u.setFullName(fullName);
        }

        return userRepository.save(u);
    }

    @PutMapping("/profile")
    public User updateProfile(@RequestBody UpdateProfile request, Authentication authentication) {
        String email = currentEmail(authentication);

        if (request == null || request.fullName() == null || request.fullName().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "fullName is required");
        }

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        user.setFullName(request.fullName().trim());
        if (request.jobTitle() != null) user.setJobTitle(request.jobTitle().trim());
        if (request.nativeLang() != null && !request.nativeLang().isBlank()) user.setNativeLang(request.nativeLang().trim());
        return userRepository.save(user);
    }

    @PutMapping("/me")
    public User updateMe(@RequestBody UpdateProfile request, Authentication authentication) {
        return updateProfile(request, authentication);
    }


    // ── Sync CEFR progress (called after test completes) ─────────────────────
    @PutMapping("/progress")
    public User updateProgress(@RequestBody ProgressUpdate request, Authentication authentication) {
        User user = userRepository.findByEmail(currentEmail(authentication))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        if (request.cefrLevel() != null && !request.cefrLevel().isBlank()) {
            user.setCefrLevel(request.cefrLevel().toUpperCase().trim());
        }
        if (request.cefrCompleted() != null) {
            user.setCefrCompleted(request.cefrCompleted());
        }
        return userRepository.save(user);
    }

    public record SessionRequest(
        String type, String phrase, int score,
        String lang, String level, String feedback
    ) {}

    // ── Session history — GET (used by Dashboard & Reports) ──────────────────
    @GetMapping("/sessions")
    public List<Map<String, Object>> getSessions(Authentication authentication) {
        User user = userRepository.findByEmail(currentEmail(authentication))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        return userSessionRepository.findByUserIdOrderByCreatedAtDesc(user.getId())
                .stream()
                .map(s -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("id",       s.getId());
                    m.put("type",     s.getType()     != null ? s.getType()     : "Session");
                    m.put("phrase",   s.getPhrase()   != null ? s.getPhrase()   : "");
                    m.put("score",    s.getScore());
                    m.put("lang",     s.getLang()     != null ? s.getLang()     : "fr");
                    m.put("level",    s.getLevel()    != null ? s.getLevel()    : "");
                    m.put("feedback", s.getFeedback() != null ? s.getFeedback() : "");
                    m.put("date",     s.getCreatedAt().toLocalDate().toString());
                    m.put("hour",     s.getCreatedAt().getHour());
                    return m;
                })
                .toList();
    }

    // ── Session save — POST (called after each practice round) ───────────────
    @PostMapping("/sessions")
    public Map<String, Object> saveSession(@RequestBody SessionRequest req, Authentication authentication) {
        User user = userRepository.findByEmail(currentEmail(authentication))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        UserSession s = new UserSession();
        s.setUser(user);
        s.setType(req.type());
        s.setPhrase(req.phrase());
        s.setScore(req.score());
        s.setLang(req.lang());
        s.setLevel(req.level());
        s.setFeedback(req.feedback());
        s.setCreatedAt(LocalDateTime.now());
        userSessionRepository.save(s);
        return Map.of("saved", true);
    }

    @PutMapping("/password")
    public String updatePassword(@RequestBody UpdatePassword request, Authentication authentication) {
        User user = userRepository.findByEmail(authentication.getName()).orElseThrow();

        if (!passwordEncoder.matches(request.oldPassword(), user.getPasswordHash())) {
            throw new RuntimeException("Wrong password");
        }

        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);

        return "Password updated";
    }
}