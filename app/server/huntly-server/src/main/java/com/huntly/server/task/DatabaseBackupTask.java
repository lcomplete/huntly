package com.huntly.server.task;

import com.huntly.server.domain.constant.AppConstants;
import com.huntly.server.domain.entity.GlobalSetting;
import com.huntly.server.service.DatabaseBackupService;
import com.huntly.server.service.GlobalSettingService;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;

/**
 * @author lcomplete
 */
@Component
@Slf4j
public class DatabaseBackupTask {
    private static final DateTimeFormatter BACKUP_TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm");

    private final GlobalSettingService settingService;
    private final DatabaseBackupService databaseBackupService;
    private final Clock clock;

    private LocalDate lastBackupDate;
    private LocalTime lastBackupTime;

    @Autowired
    public DatabaseBackupTask(GlobalSettingService settingService, DatabaseBackupService databaseBackupService) {
        this(settingService, databaseBackupService, Clock.systemDefaultZone());
    }

    DatabaseBackupTask(GlobalSettingService settingService, DatabaseBackupService databaseBackupService, Clock clock) {
        this.settingService = settingService;
        this.databaseBackupService = databaseBackupService;
        this.clock = clock;
    }

    @Scheduled(cron = "0 * * * * ?")
    public synchronized void autoBackupDatabase() {
        LocalDateTime now = LocalDateTime.now(clock).truncatedTo(ChronoUnit.MINUTES);
        GlobalSetting setting = settingService.getGlobalSetting();
        LocalTime backupTime = parseBackupTime(setting != null ? setting.getBackupTime() : null);
        if (!shouldBackup(now, backupTime)) {
            return;
        }

        databaseBackupService.backupDatabase();
        lastBackupDate = now.toLocalDate();
        lastBackupTime = backupTime;
    }

    private boolean shouldBackup(LocalDateTime now, LocalTime backupTime) {
        LocalTime currentTime = now.toLocalTime();
        if (!currentTime.equals(backupTime)) {
            return false;
        }
        return !now.toLocalDate().equals(lastBackupDate) || !backupTime.equals(lastBackupTime);
    }

    private LocalTime parseBackupTime(String backupTime) {
        if (StringUtils.isBlank(backupTime)) {
            return LocalTime.parse(AppConstants.DEFAULT_BACKUP_TIME, BACKUP_TIME_FORMATTER);
        }
        try {
            return LocalTime.parse(backupTime, BACKUP_TIME_FORMATTER);
        } catch (RuntimeException e) {
            log.warn("invalid database backup time: {}, fallback to default", backupTime);
            return LocalTime.parse(AppConstants.DEFAULT_BACKUP_TIME, BACKUP_TIME_FORMATTER);
        }
    }
}
