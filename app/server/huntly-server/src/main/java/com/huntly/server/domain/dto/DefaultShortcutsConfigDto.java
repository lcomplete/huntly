package com.huntly.server.domain.dto;

import lombok.Data;

import java.util.List;

/**
 * DTO for the root structure of default shortcuts configuration
 */
@Data
public class DefaultShortcutsConfigDto {
    private List<DefaultShortcutDto> shortcuts;
} 