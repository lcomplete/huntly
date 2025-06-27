package com.huntly.server.domain.dto;

import lombok.Data;

/**
 * DTO for default shortcut configuration
 */
@Data
public class DefaultShortcutDto {
    private String name;
    private String description;
    private String content;  // Optional, for backward compatibility
    private String file;     // File name for loading content from markdown
    private Boolean enabled;
    private Integer sortOrder;
} 