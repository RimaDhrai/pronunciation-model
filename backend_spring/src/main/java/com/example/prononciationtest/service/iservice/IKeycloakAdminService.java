package com.example.prononciationtest.service.iservice;

public interface IKeycloakAdminService {

    /**
     * Crée un utilisateur dans Keycloak et lui assigne le rôle "collaborateur".
     *
     * @param email    adresse email (= username Keycloak)
     * @param password mot de passe en clair
     * @param fullName prénom et nom complet
     * @throws IllegalArgumentException si l'email est déjà pris dans Keycloak
     * @throws RuntimeException         si la création échoue côté Keycloak
     */
    void createUser(String email, String password, String fullName);

    /**
     * Sends a Keycloak "reset password" email to the user with the given email.
     * Uses Keycloak's execute-actions-email with UPDATE_PASSWORD action.
     * @throws IllegalArgumentException if no user found with that email
     */
    void sendResetPasswordEmail(String email);

    /**
     * Met à jour le mot de passe d'un utilisateur directement via Keycloak Admin API.
     * Utilisé après validation du token de réinitialisation Spring.
     * @param email    email de l'utilisateur
     * @param newPassword nouveau mot de passe en clair
     */
    void updateUserPassword(String email, String newPassword);
}
