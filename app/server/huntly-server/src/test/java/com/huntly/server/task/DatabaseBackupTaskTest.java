package com.huntly.server.task;

import com.huntly.server.domain.entity.GlobalSetting;
import com.huntly.server.service.GlobalSettingService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import javax.sql.DataSource;
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.text.SimpleDateFormat;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class DatabaseBackupTaskTest {

    @Mock
    private GlobalSettingService settingService;

    @Mock
    private DataSource dataSource;

    @Mock
    private Connection connection;

    @Mock
    private PreparedStatement preparedStatement;

    private DatabaseBackupTask backupTask;

    @BeforeEach
    void setUp() throws SQLException {
        MockitoAnnotations.openMocks(this);
        when(dataSource.getConnection()).thenReturn(connection);
        when(connection.prepareStatement(anyString())).thenReturn(preparedStatement);
        backupTask = new DatabaseBackupTask(settingService, dataSource);
    }

    @Test
    void autoBackupDatabase_whenBackupPathNotConfigured_shouldSkip() throws SQLException {
        GlobalSetting setting = new GlobalSetting();
        setting.setBackupPath("");
        when(settingService.getGlobalSetting()).thenReturn(setting);

        backupTask.autoBackupDatabase();

        verify(dataSource, never()).getConnection();
    }

    @Test
    void autoBackupDatabase_shouldExecuteVacuumIntoAndCleanExpired(@TempDir Path backupDir) throws IOException, SQLException {
        // Mock settings
        GlobalSetting setting = new GlobalSetting();
        setting.setBackupPath(backupDir.toString());
        setting.setBackupKeepDays(2);
        when(settingService.getGlobalSetting()).thenReturn(setting);

        // Pre-create some mock backup files
        SimpleDateFormat sdf = new SimpleDateFormat("yyyyMMdd_HHmmss");

        // 1. A very old backup (e.g. 5 days ago) - should be deleted
        Instant fiveDaysAgo = Instant.now().minus(5, ChronoUnit.DAYS);
        String oldTimestamp = sdf.format(Date.from(fiveDaysAgo));
        Path oldBackupFile = backupDir.resolve("db_backup_" + oldTimestamp + ".sqlite");
        Files.writeString(oldBackupFile, "old-content");

        // 2. A recent backup (e.g. 1 day ago) - should be kept
        Instant oneDayAgo = Instant.now().minus(1, ChronoUnit.DAYS);
        String recentTimestamp = sdf.format(Date.from(oneDayAgo));
        Path recentBackupFile = backupDir.resolve("db_backup_" + recentTimestamp + ".sqlite");
        Files.writeString(recentBackupFile, "recent-content");

        // Run backup
        backupTask.autoBackupDatabase();

        // Verify VACUUM INTO was called
        verify(connection).prepareStatement(eq("VACUUM INTO ?"));
        verify(preparedStatement).setString(eq(1), anyString());
        verify(preparedStatement).execute();

        // Verify old backup was deleted
        assertThat(Files.exists(oldBackupFile)).isFalse();
        // Verify recent backup is kept
        assertThat(Files.exists(recentBackupFile)).isTrue();
    }
}
