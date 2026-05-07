package com.example.prononciationtest.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

@Configuration
@ConfigurationProperties(prefix = "level-test")
public class LevelTestConfig {

    private TimeoutConfig timeouts = new TimeoutConfig();

    public TimeoutConfig getTimeouts() {
        return timeouts;
    }

    public void setTimeouts(TimeoutConfig timeouts) {
        this.timeouts = timeouts;
    }

    public static class TimeoutConfig {
        private int phraseGeneration = 30;
        private int feedbackGeneration = 20;
        private int synthesisGeneration = 25;

        public int getPhraseGeneration() {
            return phraseGeneration;
        }

        public void setPhraseGeneration(int phraseGeneration) {
            this.phraseGeneration = phraseGeneration;
        }

        public int getFeedbackGeneration() {
            return feedbackGeneration;
        }

        public void setFeedbackGeneration(int feedbackGeneration) {
            this.feedbackGeneration = feedbackGeneration;
        }

        public int getSynthesisGeneration() {
            return synthesisGeneration;
        }

        public void setSynthesisGeneration(int synthesisGeneration) {
            this.synthesisGeneration = synthesisGeneration;
        }
    }

    @Bean(name = "levelTestExecutor")
    public ThreadPoolTaskExecutor levelTestExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(4);
        executor.setMaxPoolSize(8);
        executor.setQueueCapacity(50);
        executor.setThreadNamePrefix("level-test-");
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(30);
        executor.initialize();
        return executor;
    }
}