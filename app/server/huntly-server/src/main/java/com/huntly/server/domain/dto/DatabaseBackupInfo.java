package com.huntly.server.domain.dto;

import lombok.Data;

import java.time.Instant;

/**
 * @author lcomplete
 */
@Data
public class DatabaseBackupInfo {
    private String fileName;
    private Instant createdAt;
    private Long sizeBytes;
}