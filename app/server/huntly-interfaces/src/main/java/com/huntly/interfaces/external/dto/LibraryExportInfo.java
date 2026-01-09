package com.huntly.interfaces.external.dto;

import com.huntly.interfaces.external.model.LibraryExportStatus;
import lombok.Data;

import java.time.Instant;

/**
 * @author lcomplete
 */
@Data
public class LibraryExportInfo {
    private String fileName;
    private LibraryExportStatus status;
    private Instant startedAt;
    private Instant completedAt;
    private Long sizeBytes;
    private String message;
}
