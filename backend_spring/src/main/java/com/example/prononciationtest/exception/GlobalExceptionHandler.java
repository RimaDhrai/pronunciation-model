package com.example.prononciationtest.exception;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    // ── Structure de réponse d'erreur standard ────────────────────────────────
    private static Map<String, Object> errorBody(int status, String error, String message) {
        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", Instant.now().toString());
        body.put("status", status);
        body.put("error", error);
        body.put("message", message);
        return body;
    }

    // ── Erreurs de validation @Valid (@NotBlank, @Email, etc.) ────────────────
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> fieldErrors = new HashMap<>();
        for (FieldError fe : ex.getBindingResult().getFieldErrors()) {
            fieldErrors.put(fe.getField(), fe.getDefaultMessage());
        }
        Map<String, Object> body = errorBody(400, "Validation échouée", "Un ou plusieurs champs sont invalides");
        body.put("fields", fieldErrors);
        return ResponseEntity.badRequest().body(body);
    }

    // ── ResponseStatusException (lancée manuellement dans les controllers) ────
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> handleResponseStatus(ResponseStatusException ex) {
        int code = ex.getStatusCode().value();
        Map<String, Object> body = errorBody(code, ex.getStatusCode().toString(), ex.getReason());
        if (code >= 500) {
            log.error("[API] Erreur {}: {}", code, ex.getReason());
        }
        return ResponseEntity.status(code).body(body);
    }

    // ── Fichier audio trop volumineux ─────────────────────────────────────────
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, Object>> handleMaxUpload(MaxUploadSizeExceededException ex) {
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                .body(errorBody(413, "Fichier trop volumineux", "La taille maximale autorisée est dépassée."));
    }

    // ── Argument illégal (ex: niveau CECRL inconnu) ───────────────────────────
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalArg(IllegalArgumentException ex) {
        log.warn("[API] IllegalArgumentException: {}", ex.getMessage());
        return ResponseEntity.badRequest()
                .body(errorBody(400, "Paramètre invalide", ex.getMessage()));
    }

    // ── Catch-all : erreurs 500 non anticipées ────────────────────────────────
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGeneric(Exception ex) {
        log.error("[API] Erreur inattendue: {}", ex.getMessage(), ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(errorBody(500, "Erreur interne", "Une erreur inattendue s'est produite."));
    }
}
