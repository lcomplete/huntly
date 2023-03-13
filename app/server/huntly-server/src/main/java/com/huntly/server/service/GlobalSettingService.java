package com.huntly.server.service;

import com.huntly.server.domain.constant.AppConstants;
import com.huntly.server.domain.entity.GlobalSetting;
import com.huntly.server.domain.model.ProxySetting;
import com.huntly.server.repository.GlobalSettingRepository;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * @author lcomplete
 */
@Service
public class GlobalSettingService {
    private final GlobalSettingRepository settingRepository;

    public GlobalSettingService(GlobalSettingRepository settingRepository) {
        this.settingRepository = settingRepository;
    }

    public GlobalSetting getGlobalSetting() {
        var defaultSetting = new GlobalSetting();
        defaultSetting.setColdDataKeepDays(AppConstants.DEFAULT_COLD_DATA_KEEP_DAYS);
        var setting = settingRepository.findAll().stream().findFirst().orElse(defaultSetting);
        if (setting.getColdDataKeepDays() == null || setting.getColdDataKeepDays() <= 0) {
            setting.setColdDataKeepDays(AppConstants.DEFAULT_COLD_DATA_KEEP_DAYS);
        }
        return setting;
    }

    public ProxySetting getProxySetting() {
        GlobalSetting setting = getGlobalSetting();
        if (setting != null && Boolean.TRUE.equals(setting.getEnableProxy()) && StringUtils.isNotBlank(setting.getProxyHost()) && setting.getProxyPort() != null) {
            ProxySetting proxySetting = new ProxySetting();
            proxySetting.setHost(setting.getProxyHost());
            proxySetting.setPort(setting.getProxyPort());
            return proxySetting;
        }
        return null;
    }

    public GlobalSetting saveGlobalSetting(GlobalSetting globalSetting) {
        if (globalSetting == null) {
            return null;
        }

        GlobalSetting dbSetting = globalSetting.getId() != null && globalSetting.getId() > 0 ?
                settingRepository.findById(globalSetting.getId()).orElse(null) : null;
        if (dbSetting == null) {
            dbSetting = new GlobalSetting();
            dbSetting.setCreatedAt(globalSetting.getCreatedAt());
        }
        dbSetting.setProxyHost(globalSetting.getProxyHost());
        dbSetting.setProxyPort(globalSetting.getProxyPort());
        dbSetting.setEnableProxy(globalSetting.getEnableProxy());
        dbSetting.setColdDataKeepDays(Optional.of(globalSetting.getColdDataKeepDays()).orElse(AppConstants.DEFAULT_COLD_DATA_KEEP_DAYS));
        dbSetting.setUpdatedAt(globalSetting.getUpdatedAt());
        return settingRepository.save(dbSetting);
    }
}
