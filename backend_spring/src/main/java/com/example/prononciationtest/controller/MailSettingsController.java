package com.example.prononciationtest.controller;

import com.example.prononciationtest.entity.MailSettings;
import com.example.prononciationtest.repository.MailSettingsRepository;
import com.example.prononciationtest.service.EmailService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/admin/mail-settings")
@CrossOrigin(origins = "http://localhost:8081")
@RequiredArgsConstructor
public class MailSettingsController {

    private final MailSettingsRepository repo;
    private final EmailService emailService;

    @GetMapping
    public ResponseEntity<?> get() {
        return repo.findById(1L)
            .map(s -> ResponseEntity.ok(Map.of(
                "host",     s.getHost(),
                "port",     s.getPort(),
                "username", s.getUsername(),
                "fromName", s.getFromName(),
                "configured", true
            )))
            .orElse(ResponseEntity.ok(Map.of("configured", false)));
    }

    @PutMapping
    public ResponseEntity<?> save(@RequestBody Map<String, Object> body) {
        MailSettings s = repo.findById(1L).orElse(new MailSettings());
        if (body.containsKey("host"))     s.setHost((String) body.get("host"));
        if (body.containsKey("port"))     s.setPort((Integer) body.get("port"));
        if (body.containsKey("username")) s.setUsername((String) body.get("username"));
        if (body.containsKey("password") && !((String) body.get("password")).isBlank())
                                          s.setPassword((String) body.get("password"));
        if (body.containsKey("fromName")) s.setFromName((String) body.get("fromName"));
        repo.save(s);
        return ResponseEntity.ok(Map.of("message", "Configuration email sauvegardée"));
    }

    @PostMapping("/test")
    public ResponseEntity<?> test(@RequestBody Map<String, Object> body) {
        try {
            emailService.testConnection(
                (String) body.get("host"),
                (Integer) body.get("port"),
                (String) body.get("username"),
                (String) body.get("password")
            );
            return ResponseEntity.ok(Map.of("message", "Connexion SMTP réussie ✓"));
        } catch (Exception e) {
            return ResponseEntity.status(502).body(Map.of("message", e.getMessage()));
        }
    }
}
