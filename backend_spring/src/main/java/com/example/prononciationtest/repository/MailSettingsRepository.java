package com.example.prononciationtest.repository;

import com.example.prononciationtest.entity.MailSettings;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MailSettingsRepository extends JpaRepository<MailSettings, Long> {}
