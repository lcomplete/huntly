package com.huntly.server.domain.constant;

import com.huntly.server.config.DefaultShortcutsConfig;
import com.huntly.server.domain.dto.DefaultShortcutDto;
import com.huntly.server.domain.entity.ArticleShortcut;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

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
                shortcut.setContent(dto.getContent());
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
    

} 