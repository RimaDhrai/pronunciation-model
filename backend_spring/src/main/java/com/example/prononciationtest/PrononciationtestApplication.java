package com.example.prononciationtest;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.retry.annotation.EnableRetry;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync(proxyTargetClass = true)
@EnableRetry
public class PrononciationtestApplication {

    public static void main(String[] args) {
        SpringApplication.run(PrononciationtestApplication.class, args);
    }

}
