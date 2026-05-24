package com.huntly.server.service;

import com.huntly.server.config.HuntlyProperties;
import com.huntly.server.domain.entity.GlobalSetting;
import com.huntly.server.repository.GlobalSettingRepository;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class GlobalSettingServiceTest {

    @Test
    void getDefaultFeedFetchIntervalMinutes_returnsConfiguredFallbackWhenDbValueMissing() {
        GlobalSettingRepository settingRepository = mock(GlobalSettingRepository.class);
        HuntlyProperties huntlyProperties = new HuntlyProperties();
        huntlyProperties.setDefaultFeedFetchIntervalSeconds(900);
        when(settingRepository.findAll()).thenReturn(List.of());

        GlobalSettingService globalSettingService = new GlobalSettingService(settingRepository, huntlyProperties);

        GlobalSetting setting = globalSettingService.getGlobalSetting();
        assertThat(setting.getEnableDatabaseBackup()).isFalse();
        assertThat(setting.getBackupKeepCount()).isEqualTo(3);
        assertThat(setting.getBackupTime()).isEqualTo("02:00");
        assertThat(globalSettingService.getDefaultFeedFetchIntervalMinutes()).isEqualTo(15);
        assertThat(globalSettingService.getDefaultFeedFetchIntervalSeconds()).isEqualTo(900);
    }

    @Test
    void getGlobalSetting_returnsBackupDefaultsWhenPersistedBackupValuesAreInvalid() {
        GlobalSettingRepository settingRepository = mock(GlobalSettingRepository.class);
        HuntlyProperties huntlyProperties = new HuntlyProperties();
        huntlyProperties.setDefaultFeedFetchIntervalSeconds(900);

        GlobalSetting setting = new GlobalSetting();
        setting.setBackupKeepCount(0);
        setting.setBackupTime("25:00");
        when(settingRepository.findAll()).thenReturn(List.of(setting));

        GlobalSettingService globalSettingService = new GlobalSettingService(settingRepository, huntlyProperties);

        GlobalSetting globalSetting = globalSettingService.getGlobalSetting();
        assertThat(globalSetting.getEnableDatabaseBackup()).isFalse();
        assertThat(globalSetting.getBackupKeepCount()).isEqualTo(3);
        assertThat(globalSetting.getBackupTime()).isEqualTo("02:00");
    }

    @Test
    void getDefaultFeedFetchIntervalMinutes_returnsPersistedValueWhenPresent() {
        GlobalSettingRepository settingRepository = mock(GlobalSettingRepository.class);
        HuntlyProperties huntlyProperties = new HuntlyProperties();
        huntlyProperties.setDefaultFeedFetchIntervalSeconds(900);

        GlobalSetting setting = new GlobalSetting();
        setting.setDefaultFeedFetchIntervalMinutes(30);
        when(settingRepository.findAll()).thenReturn(List.of(setting));

        GlobalSettingService globalSettingService = new GlobalSettingService(settingRepository, huntlyProperties);

        assertThat(globalSettingService.getDefaultFeedFetchIntervalMinutes()).isEqualTo(30);
        assertThat(globalSettingService.getDefaultFeedFetchIntervalSeconds()).isEqualTo(1800);
    }
}
