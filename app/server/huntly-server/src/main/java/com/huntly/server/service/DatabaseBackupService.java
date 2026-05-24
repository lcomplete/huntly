package com.huntly.server.service;

import com.huntly.server.domain.constant.AppConstants;
import com.huntly.server.domain.dto.DatabaseBackupInfo;
import com.huntly.server.domain.entity.GlobalSetting;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;

import javax.sql.DataSource;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * @author lcomplete
 */
@Service
@Slf4j
public class DatabaseBackupService {
    private static final String BACKUP_PREFIX = "db_backup_";
    private static final String BACKUP_SUFFIX = ".sqlite";
    private static final DateTimeFormatter BACKUP_TIMESTAMP_FORMATTER = DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss");

    private final GlobalSettingService settingService;
    private final DataSource dataSource;

    public DatabaseBackupService(GlobalSettingService settingService, DataSource dataSource) {
        this.settingService = settingService;
        this.dataSource = dataSource;
    }

    public void backupDatabase() {
        log.info("start auto backup database");
        GlobalSetting setting = settingService.getGlobalSetting();
        if (setting == null || !Boolean.TRUE.equals(setting.getEnableDatabaseBackup())) {
            log.info("database backup is disabled, skip backup");
            return;
        }
        if (StringUtils.isBlank(setting.getBackupPath())) {
            log.info("database backup path is not configured, skip backup");
            return;
        }

        Path backupDir = Paths.get(setting.getBackupPath()).normalize();
        try {
            Files.createDirectories(backupDir);
        } catch (IOException e) {
            log.error("failed to create backup directory: {}", backupDir, e);
            return;
        }

        String timestamp = LocalDateTime.now().format(BACKUP_TIMESTAMP_FORMATTER);
        Path backupFile = backupDir.resolve(BACKUP_PREFIX + timestamp + BACKUP_SUFFIX);
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement("VACUUM INTO ?")) {
            stmt.setString(1, backupFile.toAbsolutePath().toString());
            stmt.execute();
            log.info("database backup successfully saved to: {}", backupFile.toAbsolutePath());
        } catch (SQLException e) {
            log.error("failed to backup database via VACUUM INTO", e);
            return;
        }

        cleanExcessBackups(backupDir, resolveKeepCount(setting));
    }

    public List<DatabaseBackupInfo> listBackups() {
        Optional<Path> backupDir = getConfiguredBackupDir();
        if (backupDir.isEmpty()) {
            return Collections.emptyList();
        }

        try {
            return listBackupPaths(backupDir.get()).stream()
                    .map(this::toBackupInfo)
                    .collect(Collectors.toList());
        } catch (IOException e) {
            log.warn("failed to list database backups", e);
            return Collections.emptyList();
        }
    }

    public Path resolveBackupPath(String fileName) {
        if (!isBackupFileName(fileName) || StringUtils.containsAny(fileName, "/", "\\") || StringUtils.contains(fileName, "..")) {
            throw new IllegalArgumentException("Invalid backup file name.");
        }

        Path backupDir = getConfiguredBackupDir()
                .orElseThrow(() -> new IllegalStateException("Backup path is not configured."));
        Path backupPath = backupDir.resolve(fileName).normalize().toAbsolutePath();
        if (!backupPath.startsWith(backupDir)) {
            throw new IllegalArgumentException("Invalid backup file name.");
        }
        return backupPath;
    }

    private int resolveKeepCount(GlobalSetting setting) {
        return setting.getBackupKeepCount() != null && setting.getBackupKeepCount() > 0
                ? setting.getBackupKeepCount()
                : AppConstants.DEFAULT_BACKUP_KEEP_COUNT;
    }

    private Optional<Path> getConfiguredBackupDir() {
        GlobalSetting setting = settingService.getGlobalSetting();
        if (setting == null || StringUtils.isBlank(setting.getBackupPath())) {
            return Optional.empty();
        }
        return Optional.of(Paths.get(setting.getBackupPath()).normalize().toAbsolutePath());
    }

    private List<Path> listBackupPaths(Path backupDir) throws IOException {
        if (Files.notExists(backupDir) || !Files.isDirectory(backupDir)) {
            return Collections.emptyList();
        }

        try (Stream<Path> stream = Files.list(backupDir)) {
            return stream
                    .filter(Files::isRegularFile)
                    .filter(path -> isBackupFileName(path.getFileName().toString()))
                    .sorted(Comparator.comparing(this::getBackupSortTime).reversed())
                    .collect(Collectors.toList());
        }
    }

    private void cleanExcessBackups(Path backupDir, int keepCount) {
        try {
            List<Path> backups = listBackupPaths(backupDir);
            if (backups.size() <= keepCount) {
                return;
            }

            for (Path backup : backups.subList(keepCount, backups.size())) {
                try {
                    Files.deleteIfExists(backup);
                    log.info("deleted excess database backup: {}", backup.getFileName());
                } catch (IOException e) {
                    log.warn("failed to delete excess database backup: {}", backup.getFileName(), e);
                }
            }
        } catch (IOException e) {
            log.warn("failed to clean excess database backups", e);
        }
    }

    private DatabaseBackupInfo toBackupInfo(Path backupPath) {
        DatabaseBackupInfo info = new DatabaseBackupInfo();
        info.setFileName(backupPath.getFileName().toString());
        info.setCreatedAt(getBackupCreatedAt(backupPath).orElse(null));
        try {
            info.setSizeBytes(Files.size(backupPath));
        } catch (IOException e) {
            info.setSizeBytes(0L);
        }
        return info;
    }

    private Instant getBackupSortTime(Path backupPath) {
        return getBackupCreatedAt(backupPath).orElse(Instant.EPOCH);
    }

    private Optional<Instant> getBackupCreatedAt(Path backupPath) {
        String fileName = backupPath.getFileName().toString();
        try {
            String timestamp = fileName.substring(BACKUP_PREFIX.length(), fileName.length() - BACKUP_SUFFIX.length());
            return Optional.of(LocalDateTime.parse(timestamp, BACKUP_TIMESTAMP_FORMATTER)
                    .atZone(ZoneId.systemDefault())
                    .toInstant());
        } catch (RuntimeException e) {
            try {
                return Optional.of(Files.getLastModifiedTime(backupPath).toInstant());
            } catch (IOException ioException) {
                return Optional.empty();
            }
        }
    }

    private boolean isBackupFileName(String fileName) {
        return StringUtils.isNotBlank(fileName)
                && fileName.startsWith(BACKUP_PREFIX)
                && fileName.endsWith(BACKUP_SUFFIX)
                && fileName.length() > BACKUP_PREFIX.length() + BACKUP_SUFFIX.length();
    }
}