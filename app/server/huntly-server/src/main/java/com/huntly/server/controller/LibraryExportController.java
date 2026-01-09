package com.huntly.server.controller;

import com.huntly.common.api.ApiResult;
import com.huntly.interfaces.external.dto.LibraryExportInfo;
import com.huntly.server.service.LibraryExportService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * @author lcomplete
 */
@RestController
@RequestMapping("/api/library-export")
@RequiredArgsConstructor
public class LibraryExportController {

    private final LibraryExportService libraryExportService;

    @PostMapping("/start")
    public ApiResult<LibraryExportInfo> startExport() {
        return ApiResult.ok(libraryExportService.startExport());
    }

    @GetMapping("/latest")
    public ApiResult<LibraryExportInfo> getLatestExport() {
        return ApiResult.ok(libraryExportService.getLatestExport());
    }

    @GetMapping("/status")
    public ApiResult<LibraryExportInfo> getExportStatus(@RequestParam(required = false) String fileName) {
        return ApiResult.ok(libraryExportService.getExportStatus(fileName));
    }

    @GetMapping("/download")
    public ResponseEntity<Resource> downloadExport(@RequestParam String fileName) throws IOException {
        Path zipPath = libraryExportService.resolveZipPath(fileName);
        if (Files.notExists(zipPath)) {
            return ResponseEntity.notFound().build();
        }
        FileSystemResource resource = new FileSystemResource(zipPath);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .contentLength(resource.contentLength())
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + zipPath.getFileName() + "\"")
                .body(resource);
    }
}
