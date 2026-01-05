package com.huntly.server.service;

import com.huntly.server.config.HuntlyProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * A shared token used by desktop clients to access /api/sync/** endpoints.
 *
 * For local Huntly (embedded server started by Tauri), the token is stored as a file
 * under {@code huntly.dataDir} so both Java and Rust can read it.
 */
@Service
@RequiredArgsConstructor
public class SyncTokenService {

    private static final String TOKEN_FILENAME = "sync-server.token";

    private final HuntlyProperties huntlyProperties;

    public String getOrCreateToken() {
        Path path = getTokenPath();
        try {
            if (Files.exists(path)) {
                String token = Files.readString(path, StandardCharsets.UTF_8).trim();
                if (StringUtils.hasText(token)) {
                    return token;
                }
            }
            String token = generateToken();
            Files.createDirectories(path.getParent());
            Files.writeString(path, token, StandardCharsets.UTF_8);
            return token;
        } catch (IOException e) {
            throw new IllegalStateException("Failed to read/write sync token file: " + path, e);
        }
    }

    public boolean isValid(String presentedToken) {
        if (!StringUtils.hasText(presentedToken)) {
            return false;
        }
        String expected = getOrCreateToken();
        return expected.equals(presentedToken);
    }

    public Path getTokenPath() {
        String dataDir = huntlyProperties.getDataDir();
        if (!StringUtils.hasText(dataDir)) {
            return Path.of(TOKEN_FILENAME).toAbsolutePath().normalize();
        }
        dataDir = dataDir.trim();
        if ((dataDir.startsWith("\"") && dataDir.endsWith("\"")) || (dataDir.startsWith("'") && dataDir.endsWith("'"))) {
            dataDir = dataDir.substring(1, dataDir.length() - 1).trim();
        }
        return Path.of(dataDir, TOKEN_FILENAME).toAbsolutePath().normalize();
    }

    private String generateToken() {
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
