package com.example.prononciationtest.service;

import com.example.prononciationtest.entity.MailSettings;
import com.example.prononciationtest.repository.MailSettingsRepository;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.util.Properties;

@Service
public class EmailService {

    private final MailSettingsRepository mailSettingsRepo;

    @Value("${spring.mail.username:}")
    private String defaultUsername;

    @Value("${spring.mail.password:}")
    private String defaultPassword;

    @Value("${spring.mail.host:smtp.office365.com}")
    private String defaultHost;

    @Value("${spring.mail.port:587}")
    private int defaultPort;

    @Value("${app.frontend.url:#{'http://localhost:8081'}}")
    private String frontendUrl;

    public EmailService(MailSettingsRepository mailSettingsRepo) {
        this.mailSettingsRepo = mailSettingsRepo;
    }

    /** Returns true if SMTP is configured either in DB or in application.properties */
    public boolean isConfigured() {
        MailSettings cfg = mailSettingsRepo.findById(1L).orElse(null);
        if (cfg != null) return cfg.getUsername() != null && !cfg.getUsername().isBlank()
                                && cfg.getPassword() != null && !cfg.getPassword().isBlank();
        return defaultUsername != null && !defaultUsername.isBlank()
            && defaultPassword != null && !defaultPassword.isBlank();
    }

    /** Builds a JavaMailSender from DB settings (if configured) or falls back to application.properties */
    private JavaMailSenderImpl buildSender() {
        MailSettings cfg = mailSettingsRepo.findById(1L).orElse(null);

        JavaMailSenderImpl sender = new JavaMailSenderImpl();
        sender.setHost(cfg != null ? cfg.getHost() : defaultHost);
        sender.setPort(cfg != null ? cfg.getPort() : defaultPort);
        sender.setUsername(cfg != null ? cfg.getUsername() : defaultUsername);
        sender.setPassword(cfg != null ? cfg.getPassword() : defaultPassword);

        Properties props = sender.getJavaMailProperties();
        props.put("mail.smtp.auth", "true");
        props.put("mail.smtp.starttls.enable", "true");
        props.put("mail.smtp.starttls.required", "true");
        return sender;
    }

    public void sendPasswordResetEmail(String to, String token) {
        JavaMailSenderImpl sender = buildSender();
        MailSettings cfg = mailSettingsRepo.findById(1L).orElse(null);
        String fromAddress = sender.getUsername();
        String fromName    = cfg != null ? cfg.getFromName() : "SpeakCoach AI";
        String resetLink   = frontendUrl + "/reset-password?token=" + token;

        String html = """
            <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:32px;border-radius:12px;background:#FEF8F3;border:1px solid #f0e6dc;">
              <h2 style="color:#E8476A;margin-bottom:8px;">Réinitialisation de mot de passe</h2>
              <p style="color:#555;font-size:15px;">Tu as demandé à réinitialiser ton mot de passe sur <strong>SpeakCoach AI</strong>.</p>
              <p style="color:#555;font-size:15px;">Clique sur le bouton ci-dessous. Ce lien expire dans <strong>1 heure</strong>.</p>
              <div style="text-align:center;margin:32px 0;">
                <a href="%s"
                   style="background:#E8476A;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:bold;display:inline-block;">
                  Réinitialiser mon mot de passe
                </a>
              </div>
              <p style="color:#999;font-size:13px;">Si tu n'es pas à l'origine de cette demande, ignore cet email.</p>
              <hr style="border:none;border-top:1px solid #f0e6dc;margin:24px 0;"/>
              <p style="color:#ccc;font-size:12px;text-align:center;">%s</p>
            </div>
            """.formatted(resetLink, fromName);

        try {
            MimeMessage message = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromAddress, fromName);
            helper.setTo(to);
            helper.setSubject("Réinitialisation de ton mot de passe — " + fromName);
            helper.setText(html, true);
            sender.send(message);
        } catch (MessagingException | java.io.UnsupportedEncodingException e) {
            throw new RuntimeException("Impossible d'envoyer l'email : " + e.getMessage(), e);
        }
    }

    /** Test connection with given settings (used by admin before saving) */
    public void testConnection(String host, int port, String username, String password) {
        JavaMailSenderImpl sender = new JavaMailSenderImpl();
        sender.setHost(host);
        sender.setPort(port);
        sender.setUsername(username);
        sender.setPassword(password);
        Properties props = sender.getJavaMailProperties();
        props.put("mail.smtp.auth", "true");
        props.put("mail.smtp.starttls.enable", "true");
        props.put("mail.smtp.starttls.required", "true");
        props.put("mail.smtp.connectiontimeout", "5000");
        props.put("mail.smtp.timeout", "5000");
        try {
            sender.testConnection();
        } catch (MessagingException e) {
            throw new RuntimeException("Connexion SMTP échouée : " + e.getMessage(), e);
        }
    }
}
