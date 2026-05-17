package com.example.prononciationtest.security;

import com.example.prononciationtest.entity.User;
import com.example.prononciationtest.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;

public class SecurityUtils {

    private SecurityUtils() {
        // Prevent instantiation of utility class
    }

    public static String getEmail(Authentication auth) {
        if (auth == null) {
            return null;
        }
        if (auth instanceof JwtAuthenticationToken jwt) {
            String email = jwt.getToken().getClaimAsString("email");
            if (email != null && !email.isBlank()) {
                return email;
            }
            String pref = jwt.getToken().getClaimAsString("preferred_username");
            if (pref != null && pref.contains("@")) {
                return pref;
            }
        }
        return auth.getName();
    }

    public static User getAuthenticatedUser(Authentication auth, UserRepository userRepo) {
        String email = getEmail(auth);
        if (email == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Accès non autorisé : authentification manquante");
        }
        return userRepo.findByEmail(email).orElseGet(() -> {
            User u = new User();
            u.setEmail(email);
            u.setPasswordHash("KC_MANAGED");
            u.setCreatedAt(Instant.now());
            u.setEnabled(true);
            return userRepo.save(u);
        });
    }

    public static User getAuthenticatedUserOrNull(Authentication auth, UserRepository userRepo) {
        if (auth == null) {
            return null;
        }
        String email = getEmail(auth);
        if (email == null || email.isBlank() || "anonymousUser".equals(email)) {
            return null;
        }
        return userRepo.findByEmail(email).orElse(null);
    }
}
