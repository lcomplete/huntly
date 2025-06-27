package com.huntly.server.domain.constant;

import com.huntly.server.config.DefaultShortcutsConfig;
import com.huntly.server.domain.dto.DefaultShortcutDto;
import com.huntly.server.domain.entity.ArticleShortcut;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.util.StreamUtils;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Default shortcut presets loaded from JSON configuration
 */
@Slf4j
@Component
public class DefaultShortcuts {
    
    private final DefaultShortcutsConfig config;
    
    public DefaultShortcuts(DefaultShortcutsConfig config) {
        this.config = config;
    }
    
    /**
     * Get the list of default shortcuts from JSON configuration
     * @return list of default article shortcuts
     */
    public List<ArticleShortcut> getDefaultShortcuts() {
        try {
            if (config.getConfig() == null || config.getConfig().getShortcuts() == null) {
                log.warn("No default shortcuts configuration found");
                return Collections.emptyList();
            }
            
            List<ArticleShortcut> shortcuts = new ArrayList<>();
            Instant now = Instant.now();
            
            for (DefaultShortcutDto dto : config.getConfig().getShortcuts()) {
                ArticleShortcut shortcut = new ArticleShortcut();
                shortcut.setName(dto.getName());
                shortcut.setDescription(dto.getDescription());
                
                // Load content from file if specified, otherwise use content from JSON
                String content = loadShortcutContent(dto);
                shortcut.setContent(content);
                
                shortcut.setEnabled(dto.getEnabled() != null ? dto.getEnabled() : true);
                shortcut.setSortOrder(dto.getSortOrder());
                shortcut.setCreatedAt(now);
                shortcut.setUpdatedAt(now);
                shortcuts.add(shortcut);
            }
            
            log.info("Loaded {} default shortcuts from configuration", shortcuts.size());
            return shortcuts;
        } catch (Exception e) {
            log.error("Error loading default shortcuts from configuration", e);
            return Collections.emptyList();
        }
    }
    
    /**
     * Load shortcut content from file or JSON
     * @param dto the shortcut DTO
     * @return the content string
     */
    private String loadShortcutContent(DefaultShortcutDto dto) {
        // If file is specified, try to load from file
        if (dto.getFile() != null && !dto.getFile().isEmpty()) {
            try {
                String filePath = "config/shortcuts/" + dto.getFile();
                ClassPathResource resource = new ClassPathResource(filePath);
                try (InputStream inputStream = resource.getInputStream()) {
                    String content = StreamUtils.copyToString(inputStream, StandardCharsets.UTF_8);
                    log.debug("Loaded content from file: {}", dto.getFile());
                    return content;
                }
            } catch (IOException e) {
                log.error("Failed to load content from file: {}, falling back to JSON content", dto.getFile(), e);
                // Fall back to content from JSON if file loading fails
                return dto.getContent() != null ? dto.getContent() : "";
            }
        }
        
        // Use content from JSON
        return dto.getContent() != null ? dto.getContent() : "";
    }

} 