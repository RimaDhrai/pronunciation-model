package com.example.prononciationtest.service;

import com.example.prononciationtest.service.iservice.IKeycloakAdminService;
import com.fasterxml.jackson.annotation.JsonProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

/**
 * Crée et gère des utilisateurs dans Keycloak via l'Admin REST API.
 * Utilisé par AuthController pour le endpoint /auth/register.
 */
@Service
public class KeycloakAdminService implements IKeycloakAdminService {

    private static final Logger log = LoggerFactory.getLogger(KeycloakAdminService.class);

    // ── DTOs Keycloak (records immuables, sérialisés proprement par Jackson) ──

    record CredentialRepresentation(
        @JsonProperty("type")      String type,
        @JsonProperty("value")     String value,
        @JsonProperty("temporary") boolean temporary
    ) {}

    record UserRepresentation(
        @JsonProperty("username")      String username,
        @JsonProperty("email")         String email,
        @JsonProperty("firstName")     String firstName,
        @JsonProperty("lastName")      String lastName,
        @JsonProperty("enabled")       boolean enabled,
        @JsonProperty("emailVerified") boolean emailVerified,
        @JsonProperty("credentials")   List<CredentialRepresentation> credentials
    ) {}

    // ─────────────────────────────────────────────────────────────────────────

    @Value("${keycloak.admin.url}")
    private String keycloakUrl;

    @Value("${keycloak.admin.realm}")
    private String realm;

    @Value("${keycloak.admin.master-realm}")
    private String masterRealm;

    @Value("${keycloak.admin.username}")
    private String adminUsername;

    @Value("${keycloak.admin.password}")
    private String adminPassword;

    @Value("${keycloak.admin.client-id}")
    private String clientId;

    @Value("${app.frontend.url:http://localhost:8081}")
    private String frontendUrl;

    private static final ParameterizedTypeReference<Map<String, Object>> MAP_TYPE =
        new ParameterizedTypeReference<>() {};

    private static final ParameterizedTypeReference<List<Map<String, Object>>> LIST_MAP_TYPE =
        new ParameterizedTypeReference<>() {};

    private final RestTemplate rest = new RestTemplate();

    // ── Obtenir un token admin via le realm master ────────────────────────────
    private String getAdminToken() {
        String url = keycloakUrl + "/realms/" + masterRealm + "/protocol/openid-connect/token";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("grant_type", "password");
        body.add("client_id", "admin-cli");
        body.add("username", adminUsername);
        body.add("password", adminPassword);

        ResponseEntity<Map<String, Object>> resp = rest.exchange(
            url, HttpMethod.POST,
            new HttpEntity<>(body, headers),
            MAP_TYPE
        );
        Map<String, Object> respBody = resp.getBody();
        if (respBody == null || !respBody.containsKey("access_token")) {
            throw new IllegalStateException("Keycloak n'a pas retourné de token admin");
        }
        return (String) respBody.get("access_token");
    }

    // ── Crée l'utilisateur dans Keycloak et lui assigne le rôle collaborateur ─
    /**
     * @param email     adresse email (= username dans Keycloak)
     * @param password  mot de passe en clair
     * @param fullName  prénom + nom complet
     * @throws IllegalArgumentException si l'email est déjà pris dans Keycloak
     */
    public void createUser(String email, String password, String fullName) {
        String token = getAdminToken();
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        headers.setContentType(MediaType.APPLICATION_JSON);

        // Sépare prénom / nom sur le premier espace
        int space = fullName.indexOf(' ');
        String firstName = space > 0 ? fullName.substring(0, space) : fullName;
        String lastName  = space > 0 ? fullName.substring(space + 1) : "";

        UserRepresentation payload = new UserRepresentation(
            email, email, firstName, lastName, true, true,
            List.of(new CredentialRepresentation("password", password, false))
        );

        String createUrl = keycloakUrl + "/admin/realms/" + realm + "/users";
        try {
            rest.exchange(createUrl, HttpMethod.POST,
                new HttpEntity<>(payload, headers), Void.class);
        } catch (HttpClientErrorException.Conflict e) {
            throw new IllegalArgumentException("Email déjà utilisé dans Keycloak : " + email);
        }

        // Récupère l'ID du nouvel utilisateur
        String searchUrl = createUrl + "?username=" + email;
        ResponseEntity<List<Map<String, Object>>> found = rest.exchange(
            searchUrl, HttpMethod.GET,
            new HttpEntity<>(headers), LIST_MAP_TYPE
        );
        if (found.getBody() == null || found.getBody().isEmpty()) {
            throw new RuntimeException("Utilisateur créé mais introuvable dans Keycloak");
        }
        String userId = (String) found.getBody().get(0).get("id");

        // Assigne le rôle "collaborateur" — non-bloquant si le rôle n'existe pas
        try {
            String roleUrl = keycloakUrl + "/admin/realms/" + realm + "/roles/collaborateur";
            ResponseEntity<Map<String, Object>> roleResp = rest.exchange(
                roleUrl, HttpMethod.GET,
                new HttpEntity<>(headers), MAP_TYPE
            );
            Map<String, Object> roleBody = roleResp.getBody();
            if (roleBody == null) {
                throw new IllegalStateException("Réponse vide pour le rôle 'collaborateur'");
            }
            String assignUrl = keycloakUrl + "/admin/realms/" + realm
                             + "/users/" + userId + "/role-mappings/realm";
            rest.exchange(assignUrl, HttpMethod.POST,
                new HttpEntity<>(List.of(roleBody), headers), Void.class);
            log.info("[Keycloak] Rôle 'collaborateur' assigné à userId={}", userId);
        } catch (Exception roleEx) {
            // Le rôle n'existe pas encore dans ce realm — l'utilisateur est créé sans rôle.
            // Il pourra tout de même se connecter ; l'admin pourra assigner le rôle manuellement.
            log.warn("[Keycloak] Rôle 'collaborateur' introuvable ou assignation échouée pour userId={} : {}. " +
                     "Crée ce rôle dans Keycloak Admin → Realm roles → Add role → 'collaborateur'", userId, roleEx.getMessage());
        }
        log.info("[Keycloak] Utilisateur créé avec succès : email={} userId={}", email, userId);
    }

    // ── Envoie un email de réinitialisation de mot de passe via Keycloak ─────
    @Override
    public void sendResetPasswordEmail(String email) {
        String token = getAdminToken();

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        headers.setContentType(MediaType.APPLICATION_JSON);

        // Recherche l'utilisateur par email (correspondance exacte)
        String searchUrl = keycloakUrl + "/admin/realms/" + realm + "/users?email=" + email + "&exact=true";
        ResponseEntity<List<Map<String, Object>>> found = rest.exchange(
            searchUrl, HttpMethod.GET,
            new HttpEntity<>(headers), LIST_MAP_TYPE
        );

        if (found.getBody() == null || found.getBody().isEmpty()) {
            throw new IllegalArgumentException("Aucun compte associé à cet email");
        }

        String userId = (String) found.getBody().get(0).get("id");

        // Déclenche l'envoi de l'email UPDATE_PASSWORD via Keycloak
        // client_id + redirect_uri → l'utilisateur revient sur notre page login après reset
        String redirectUri = frontendUrl + "/login";
        String actionsUrl = keycloakUrl + "/admin/realms/" + realm
                          + "/users/" + userId + "/execute-actions-email"
                          + "?client_id=" + clientId
                          + "&redirect_uri=" + java.net.URLEncoder.encode(redirectUri, java.nio.charset.StandardCharsets.UTF_8);
        log.info("[Keycloak] Envoi email reset à userId={} email={}", userId, email);
        try {
            rest.exchange(actionsUrl, HttpMethod.PUT,
                new HttpEntity<>(List.of("UPDATE_PASSWORD"), headers), Void.class);
            log.info("[Keycloak] Email reset envoyé avec succès pour {}", email);
        } catch (HttpClientErrorException e) {
            log.error("[Keycloak] Erreur HTTP {} lors de execute-actions-email : {}",
                e.getStatusCode(), e.getResponseBodyAsString());
            throw e;
        }
    }

    // ── Met à jour directement le mot de passe d'un utilisateur ──────────────
    @Override
    public void updateUserPassword(String email, String newPassword) {
        String token = getAdminToken();
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        headers.setContentType(MediaType.APPLICATION_JSON);

        // Récupère l'utilisateur par email
        String searchUrl = keycloakUrl + "/admin/realms/" + realm + "/users?email=" + email + "&exact=true";
        ResponseEntity<List<Map<String, Object>>> found = rest.exchange(
            searchUrl, HttpMethod.GET, new HttpEntity<>(headers), LIST_MAP_TYPE
        );
        if (found.getBody() == null || found.getBody().isEmpty()) {
            throw new IllegalArgumentException("Aucun compte associé à cet email : " + email);
        }
        String userId = (String) found.getBody().get(0).get("id");

        // Met à jour le credential
        String resetUrl = keycloakUrl + "/admin/realms/" + realm + "/users/" + userId + "/reset-password";
        CredentialRepresentation cred = new CredentialRepresentation("password", newPassword, false);
        rest.exchange(resetUrl, HttpMethod.PUT, new HttpEntity<>(cred, headers), Void.class);
        log.info("[Keycloak] Mot de passe mis à jour pour userId={}", userId);
    }
}
