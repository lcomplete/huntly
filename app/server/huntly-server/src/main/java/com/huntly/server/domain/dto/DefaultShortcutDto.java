package com.huntly.server.domain.dto;

import lombok.Data;

/**
 * DTO for default shortcut configuration
 */
@Data
public class DefaultShortcutDto {
    private String name;
    private String description;
    private String content;
    private Boolean enabled;
    private Integer sortOrder;
} 