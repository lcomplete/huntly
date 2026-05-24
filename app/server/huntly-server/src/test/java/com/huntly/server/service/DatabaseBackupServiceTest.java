package com.huntly.server.service;

import com.huntly.server.domain.dto.DatabaseBackupInfo;
import com.huntly.server.domain.entity.GlobalSetting;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import javax.sql.DataSource;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class DatabaseBackupServiceTest {
    private static final DateTimeFormatter BACKUP_TIMESTAMP_FORMATTER = DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss");

    @Mock
    private GlobalSettingService settingService;

    @Mock
    private DataSource dataSource;

    @Mock
    private Connection connection;

    @Mock
    private PreparedStatement preparedStatement;

    private DatabaseBackupService backupService;

    @BeforeEach
    void setUp() throws SQLException {
        MockitoAnnotations.openMocks(this);
        when(dataSource.getConnection()).thenReturn(connection);
        when(connection.prepareStatement(anyString())).thenReturn(preparedStatement);
        backupService = new DatabaseBackupService(settingService, dataSource);
    }

    @Test
    void backupDatabase_whenBackupDisabled_shouldSkip(@TempDir Path backupDir) throws SQLException {
        GlobalSetting setting = new GlobalSetting();
        setting.setEnableDatabaseBackup(false);
        setting.setBackupPath(backupDir.toString());
        when(settingService.getGlobalSetting()).thenReturn(setting);

        backupService.backupDatabase();

        verify(dataSource, never()).getConnection();
    }

    @Test
    void backupDatabase_whenBackupPathNotConfigured_shouldSkip() throws SQLException {
        GlobalSetting setting = new GlobalSetting();
        setting.setEnableDatabaseBackup(true);
        setting.setBackupPath("");
        when(settingService.getGlobalSetting()).thenReturn(setting);

        backupService.backupDatabase();

        verify(dataSource, never()).getConnection();
    }

    @Test
    void backupDatabase_shouldExecuteVacuumIntoAndKeepLatestBackups(@TempDir Path backupDir) throws IOException, SQLException {
        GlobalSetting setting = new GlobalSetting();
        setting.setEnableDatabaseBackup(true);
        setting.setBackupPath(backupDir.toString());
        setting.setBackupKeepCount(2);
        when(settingService.getGlobalSetting()).thenReturn(setting);

        Path oldBackupFile = createBackupFile(backupDir, LocalDateTime.now().minusHours(3), "old-content");
        Path middleBackupFile = createBackupFile(backupDir, LocalDateTime.now().minusHours(2), "middle-content");
        Path recentBackupFile = createBackupFile(backupDir, LocalDateTime.now().minusHours(1), "recent-content");

        AtomicReference<String> generatedBackupPath = new AtomicReference<>();
        doAnswer(invocation -> {
            generatedBackupPath.set(invocation.getArgument(1));
            return null;
        }).when(preparedStatement).setString(eq(1), anyString());
        doAnswer(invocation -> {
            Files.writeString(Path.of(generatedBackupPath.get()), "new-content");
            return true;
        }).when(preparedStatement).execute();

        backupService.backupDatabase();

        verify(connection).prepareStatement(eq("VACUUM INTO ?"));
        verify(preparedStatement).setString(eq(1), anyString());
        verify(preparedStatement).execute();

        assertThat(Files.exists(Path.of(generatedBackupPath.get()))).isTrue();
        assertThat(Files.exists(recentBackupFile)).isTrue();
        assertThat(Files.exists(middleBackupFile)).isFalse();
        assertThat(Files.exists(oldBackupFile)).isFalse();
        try (Stream<Path> backups = Files.list(backupDir)) {
            assertThat(backups.filter(path -> path.getFileName().toString().startsWith("db_backup_")).count()).isEqualTo(2);
        }
    }

    @Test
    void listBackups_shouldReturnConfiguredBackupsNewestFirst(@TempDir Path backupDir) throws IOException {
        GlobalSetting setting = new GlobalSetting();
        setting.setBackupPath(backupDir.toString());
        when(settingService.getGlobalSetting()).thenReturn(setting);

        createBackupFile(backupDir, LocalDateTime.now().minusHours(2), "old-content");
        Path recentBackupFile = createBackupFile(backupDir, LocalDateTime.now().minusHours(1), "recent-content");
        Files.writeString(backupDir.resolve("not-a-backup.txt"), "ignored");

        List<DatabaseBackupInfo> backups = backupService.listBackups();

        assertThat(backups).hasSize(2);
        assertThat(backups.get(0).getFileName()).isEqualTo(recentBackupFile.getFileName().toString());
        assertThat(backups.get(0).getSizeBytes()).isEqualTo(Files.size(recentBackupFile));
    }

    @Test
    void resolveBackupPath_shouldRejectInvalidFileName(@TempDir Path backupDir) {
        GlobalSetting setting = new GlobalSetting();
        setting.setBackupPath(backupDir.toString());
        when(settingService.getGlobalSetting()).thenReturn(setting);

        assertThatThrownBy(() -> backupService.resolveBackupPath("../db_backup_20260524_020000.sqlite"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private Path createBackupFile(Path backupDir, LocalDateTime backupTime, String content) throws IOException {
        Path backupFile = backupDir.resolve("db_backup_" + backupTime.format(BACKUP_TIMESTAMP_FORMATTER) + ".sqlite");
        Files.writeString(backupFile, content);
        return backupFile;
    }
}