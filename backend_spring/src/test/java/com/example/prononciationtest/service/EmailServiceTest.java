package com.example.prononciationtest.service;

import com.example.prononciationtest.entity.MailSettings;
import com.example.prononciationtest.repository.MailSettingsRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EmailServiceTest {

    @Mock
    private MailSettingsRepository mailSettingsRepo;

    private EmailService emailService;

    @BeforeEach
    void setUp() {
        emailService = new EmailService(mailSettingsRepo);
        ReflectionTestUtils.setField(emailService, "defaultUsername", "default@test.com");
        ReflectionTestUtils.setField(emailService, "defaultPassword", "default_pwd");
        ReflectionTestUtils.setField(emailService, "defaultHost", "smtp.test.com");
        ReflectionTestUtils.setField(emailService, "defaultPort", 587);
        ReflectionTestUtils.setField(emailService, "frontendUrl", "http://frontend.com");
    }

    @Test
    void isConfigured_whenDbSettingsConfigured_returnsTrue() {
        MailSettings settings = new MailSettings();
        settings.setUsername("admin@smtp.com");
        settings.setPassword("pass");
        
        when(mailSettingsRepo.findById(1L)).thenReturn(Optional.of(settings));

        assertThat(emailService.isConfigured()).isTrue();
    }

    @Test
    void isConfigured_whenDbSettingsEmptyButDefaultSettingsConfigured_returnsTrue() {
        when(mailSettingsRepo.findById(1L)).thenReturn(Optional.empty());

        assertThat(emailService.isConfigured()).isTrue();
    }

    @Test
    void isConfigured_whenBothEmpty_returnsFalse() {
        ReflectionTestUtils.setField(emailService, "defaultUsername", null);
        when(mailSettingsRepo.findById(1L)).thenReturn(Optional.empty());

        assertThat(emailService.isConfigured()).isFalse();
    }

    @Test
    void testConnection_failsWithInvalidSmtp_throwsException() {
        assertThatThrownBy(() -> emailService.testConnection("smtp.invalid.local", 25, "user", "pass"))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Connexion SMTP échouée");
    }

    @Test
    void sendPasswordResetEmail_buildsSenderAndAttemptsToSend() {
        MailSettings settings = new MailSettings();
        settings.setUsername("admin@smtp.com");
        settings.setPassword("pass");
        settings.setHost("smtp.test.com");
        settings.setPort(587);
        settings.setFromName("SpeakCoach Team");

        when(mailSettingsRepo.findById(1L)).thenReturn(Optional.of(settings));

        // When sending password reset email, JavaMailSenderImpl will attempt connection and fail 
        // since SMTP server is offline, but this ensures all line coverage of buildSender and message creation works!
        assertThatThrownBy(() -> emailService.sendPasswordResetEmail("user@recipient.com", "reset-token-123"))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Impossible d'envoyer l'email");
    }
}
