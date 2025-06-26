package com.huntly.server.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.huntly.server.domain.dto.DefaultShortcutsConfigDto;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;

/**
 * Configuration class for loading default shortcuts from JSON file
 */
@Slf4j
@Component
public class DefaultShortcutsConfig {
    
    private final ObjectMapper objectMapper;
    private DefaultShortcutsConfigDto config;
    
    public DefaultShortcutsConfig(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        loadConfig();
    }
    
    /**
     * Load the default shortcuts configuration from JSON file
     */
    private void loadConfig() {
        try {
            ClassPathResource resource = new ClassPathResource("config/default-shortcuts.json");
            try (InputStream inputStream = resource.getInputStream()) {
                this.config = objectMapper.readValue(inputStream, DefaultShortcutsConfigDto.class);
                log.info("Successfully loaded {} default shortcuts from configuration", 
                        config.getShortcuts() != null ? config.getShortcuts().size() : 0);
            }
        } catch (IOException e) {
            log.error("Failed to load default shortcuts configuration", e);
            // Initialize with empty config if loading fails
            this.config = new DefaultShortcutsConfigDto();
        }
    }
    
    /**
     * Get the loaded configuration
     * @return the default shortcuts configuration
     */
    public DefaultShortcutsConfigDto getConfig() {
        return config;
    }
} 