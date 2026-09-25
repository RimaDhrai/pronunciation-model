package com.example.prononciationtest.controller;

import com.example.prononciationtest.entity.PasswordResetToken;
import com.example.prononciationtest.entity.User;
import com.example.prononciationtest.repository.PasswordResetTokenRepository;
import com.example.prononciationtest.repository.UserRepository;
import com.example.prononciationtest.service.EmailService;
import com.example.prononciationtest.service.iservice.IKeycloakAdminService;
import jakarta.transaction.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    private final IKeycloakAdminService         keycloakAdmin;
    private final UserRepository                userRepository;
    private final PasswordEncoder               passwordEncoder;
    private final PasswordResetTokenRepository  tokenRepository;
    private final EmailService                  emailService;

    public AuthController(IKeycloakAdminService keycloakAdmin,
                          UserRepository userRepository,
                          PasswordEncoder passwordEncoder,
                          PasswordResetTokenRepository tokenRepository,
                          EmailService emailService) {
        this.keycloakAdmin   = keycloakAdmin;
        this.userRepository  = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.tokenRepository = tokenRepository;
        this.emailService    = emailService;
    }

    /**
     * POST /auth/forgot-password
     * Génère un token UUID en BDD et envoie un email direct via Spring JavaMailSender.
     * Toujours 200 pour ne pas fuiter l'existence d'un compte.
     */
    @PostMapping("/forgot-password")
    @Transactional
    public ResponseEntity<?> forgotPassword(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        if (email == null || email.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Email requis"));
        }
        email = email.trim().toLowerCase();

        // Nettoie les anciens tokens expirés
        tokenRepository.deleteExpired(LocalDateTime.now());

        // Vérifie que SMTP est configuré avant tout
        if (!emailService.isConfigured()) {
            log.warn("[Auth] SMTP non configuré — configure via /admin/mail-settings");
            return ResponseEntity.status(503).body(Map.of(
                "message", "Service email non configuré. Contacte l'administrateur.",
                "code", "SMTP_NOT_CONFIGURED"
            ));
        }

        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isPresent()) {
            String token = UUID.randomUUID().toString();
            tokenRepository.save(new PasswordResetToken(token, email, LocalDateTime.now().plusHours(1)));
            try {
                emailService.sendPasswordResetEmail(email, token);
                log.info("[Auth] Email reset envoyé à {}", email);
            } catch (Exception ex) {
                log.error("[Auth] Erreur envoi email reset pour {} : {}", email, ex.getMessage());
                return ResponseEntity.status(502).body(Map.of("message", "Échec d'envoi de l'email. Vérifie la config SMTP dans /admin/mail-settings."));
            }
        } else {
            log.warn("[Auth] Demande de reset ignorée : l'email {} n'existe pas en BDD.", email);
        }

        return ResponseEntity.ok(Map.of("message", "Si cet email est enregistré, un lien de réinitialisation a été envoyé."));
    }

    /**
     * POST /auth/reset-password
     * Body: { "token": "...", "password": "nouveau_mdp" }
     * Valide le token, met à jour le mot de passe dans Keycloak + BDD locale.
     */
    @PostMapping("/reset-password")
    @Transactional
    public ResponseEntity<?> resetPassword(@RequestBody Map<String, String> body) {
        String token    = body.get("token");
        String password = body.get("password");

        if (token == null || token.isBlank() || password == null || password.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Token et mot de passe requis"));
        }
        if (password.length() < 8) {
            return ResponseEntity.badRequest().body(Map.of("message", "Le mot de passe doit contenir au moins 8 caractères"));
        }

        Optional<PasswordResetToken> tokenOpt = tokenRepository.findByToken(token);
        if (tokenOpt.isEmpty()) {
            return ResponseEntity.status(400).body(Map.of("message", "Lien invalide ou déjà utilisé"));
        }

        PasswordResetToken resetToken = tokenOpt.get();
        if (resetToken.isUsed()) {
            return ResponseEntity.status(400).body(Map.of("message", "Ce lien a déjà été utilisé"));
        }
        if (resetToken.getExpiresAt().isBefore(LocalDateTime.now())) {
            return ResponseEntity.status(400).body(Map.of("message", "Ce lien a expiré. Refais une demande."));
        }

        String email = resetToken.getEmail();

        // Met à jour dans Keycloak
        try {
            keycloakAdmin.updateUserPassword(email, password);
        } catch (Exception ex) {
            log.error("[Auth] Erreur Keycloak reset password pour {} : {}", email, ex.getMessage());
            return ResponseEntity.status(502).body(Map.of("message", "Erreur lors de la mise à jour du mot de passe"));
        }

        // Met à jour dans la BDD locale
        userRepository.findByEmail(email).ifPresent(user -> {
            user.setPasswordHash(passwordEncoder.encode(password));
            userRepository.save(user);
        });

        // Invalide le token
        resetToken.setUsed(true);
        tokenRepository.save(resetToken);

        log.info("[Auth] Mot de passe réinitialisé avec succès pour {}", email);
        return ResponseEntity.ok(Map.of("message", "Mot de passe mis à jour avec succès"));
    }

    /**
     * POST /auth/register
     * Body JSON : { "email", "password", "fullName" }
     */
    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String, String> body) {
        String email    = body.get("email");
        String password = body.get("password");
        String fullName = body.get("fullName");

        if (email == null || password == null || fullName == null
                || email.isBlank() || password.isBlank() || fullName.isBlank()) {
            return ResponseEntity.badRequest()
                .body(Map.of("message", "email, password et fullName sont requis"));
        }

        if (userRepository.existsByEmail(email)) {
            return ResponseEntity.status(409)
                .body(Map.of("message", "Adresse email déjà utilisée"));
        }

        try {
            keycloakAdmin.createUser(email, password, fullName);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(409).body(Map.of("message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(502)
                .body(Map.of("message", "Impossible de créer le compte Keycloak : " + e.getMessage()));
        }

        User user = new User();
        user.setEmail(email);
        user.setFullName(fullName);
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setCreatedAt(Instant.now());
        user.setEnabled(true);
        userRepository.save(user);

        return ResponseEntity.status(201)
            .body(Map.of("message", "Compte créé avec succès", "email", email));
    }
}
