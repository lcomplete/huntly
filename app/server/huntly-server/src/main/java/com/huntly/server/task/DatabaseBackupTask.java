package com.huntly.server.task;

import com.huntly.server.domain.entity.GlobalSetting;
import com.huntly.server.service.GlobalSettingService;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.io.File;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.text.SimpleDateFormat;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;

/**
 * @author lcomplete
 */
@Component
@Slf4j
public class DatabaseBackupTask {
    private final GlobalSettingService settingService;
    private final DataSource dataSource;

    public DatabaseBackupTask(GlobalSettingService settingService, DataSource dataSource) {
        this.settingService = settingService;
        this.dataSource = dataSource;
    }

    /**
     * Automatically backup database every day at 2:00 AM.
     */
    @Scheduled(cron = "0 0 2 * * ?")
    public void autoBackupDatabase() {
        log.info("start auto backup database");
        GlobalSetting setting = settingService.getGlobalSetting();
        if (setting == null || StringUtils.isBlank(setting.getBackupPath())) {
            log.info("database backup path is not configured, skip backup");
            return;
        }

        String backupPath = setting.getBackupPath();
        File backupDir = new File(backupPath);
        if (!backupDir.exists()) {
            if (!backupDir.mkdirs()) {
                log.error("failed to create backup directory: {}", backupPath);
                return;
            }
        }

        // Perform backup using SQLite VACUUM INTO for data consistency
        String timestamp = new SimpleDateFormat("yyyyMMdd_HHmmss").format(new Date());
        File backupFile = new File(backupDir, "db_backup_" + timestamp + ".sqlite");
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement("VACUUM INTO ?")) {
            stmt.setString(1, backupFile.getAbsolutePath());
            stmt.execute();
            log.info("database backup successfully saved to: {}", backupFile.getAbsolutePath());
        } catch (SQLException e) {
            log.error("failed to backup database via VACUUM INTO", e);
            return;
        }

        // Clean expired backups
        int keepDays = setting.getBackupKeepDays() != null && setting.getBackupKeepDays() > 0
                ? setting.getBackupKeepDays()
                : 30; // default keep for 30 days

        cleanOldBackups(backupDir, keepDays);
    }

    private void cleanOldBackups(File backupDir, int keepDays) {
        File[] files = backupDir.listFiles((dir, name) -> name.startsWith("db_backup_") && name.endsWith(".sqlite"));
        if (files == null || files.length == 0) {
            return;
        }

        Instant limitTime = Instant.now().minus(keepDays, ChronoUnit.DAYS);
        SimpleDateFormat sdf = new SimpleDateFormat("yyyyMMdd_HHmmss");

        for (File file : files) {
            String name = file.getName();
            try {
                String timestampStr = name.substring("db_backup_".length(), name.length() - ".sqlite".length());
                Date date = sdf.parse(timestampStr);
                if (date.toInstant().isBefore(limitTime)) {
                    if (file.delete()) {
                        log.info("deleted old database backup: {}", file.getName());
                    } else {
                        log.warn("failed to delete old backup: {}", file.getName());
                    }
                }
            } catch (Exception e) {
                log.warn("failed to parse backup file name timestamp: {}", name);
            }
        }
    }
}
