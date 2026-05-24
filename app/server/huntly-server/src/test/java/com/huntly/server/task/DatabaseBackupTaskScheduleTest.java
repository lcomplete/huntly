package com.huntly.server.task;

import com.huntly.server.domain.entity.GlobalSetting;
import com.huntly.server.service.DatabaseBackupService;
import com.huntly.server.service.GlobalSettingService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class DatabaseBackupTaskScheduleTest {
    private GlobalSettingService settingService;
    private DatabaseBackupService databaseBackupService;
    private MutableClock clock;
    private DatabaseBackupTask task;

    @BeforeEach
    void setUp() {
        settingService = mock(GlobalSettingService.class);
        databaseBackupService = mock(DatabaseBackupService.class);
        clock = new MutableClock(ZoneId.systemDefault());
        task = new DatabaseBackupTask(settingService, databaseBackupService, clock);
    }

    @Test
    void autoBackupDatabase_shouldUseUpdatedBackupTimeOnEachCheck() {
        GlobalSetting setting = new GlobalSetting();
        setting.setBackupTime("03:00");
        when(settingService.getGlobalSetting()).thenReturn(setting);
        clock.setTime(LocalDateTime.of(2026, 5, 24, 1, 59));

        task.autoBackupDatabase();

        verify(databaseBackupService, never()).backupDatabase();

        setting.setBackupTime("02:00");
        clock.setTime(LocalDateTime.of(2026, 5, 24, 2, 0));

        task.autoBackupDatabase();

        verify(databaseBackupService).backupDatabase();
    }

    @Test
    void autoBackupDatabase_shouldNotRunTwiceForSameConfiguredMinute() {
        GlobalSetting setting = new GlobalSetting();
        setting.setBackupTime("02:00");
        when(settingService.getGlobalSetting()).thenReturn(setting);
        clock.setTime(LocalDateTime.of(2026, 5, 24, 2, 0));

        task.autoBackupDatabase();
        task.autoBackupDatabase();

        verify(databaseBackupService).backupDatabase();
    }

    @Test
    void autoBackupDatabase_shouldFallbackToDefaultBackupTime() {
        GlobalSetting setting = new GlobalSetting();
        setting.setBackupTime("25:00");
        when(settingService.getGlobalSetting()).thenReturn(setting);
        clock.setTime(LocalDateTime.of(2026, 5, 24, 2, 0));

        task.autoBackupDatabase();

        verify(databaseBackupService).backupDatabase();
    }

    private static class MutableClock extends Clock {
        private final ZoneId zone;
        private Instant instant;

        private MutableClock(ZoneId zone) {
            this.zone = zone;
        }

        private void setTime(LocalDateTime dateTime) {
            this.instant = dateTime.atZone(zone).toInstant();
        }

        @Override
        public ZoneId getZone() {
            return zone;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            MutableClock clock = new MutableClock(zone);
            clock.instant = instant;
            return clock;
        }

        @Override
        public Instant instant() {
            return instant;
        }
    }
}
