package com.huntly.server.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Configuration to conditionally enable or disable scheduling
 */
@Configuration
@EnableScheduling
@ConditionalOnProperty(name = "huntly.scheduling.enabled", havingValue = "true", matchIfMissing = true)
public class SchedulingConfig {
    // This configuration class enables scheduling when the property is true or not set
} 