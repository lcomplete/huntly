package com.huntly.server.service;

import com.huntly.server.domain.entity.GlobalSetting;
import com.huntly.server.domain.model.ProxySetting;
import com.huntly.server.repository.GlobalSettingRepository;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;

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
        return settingRepository.findAll().stream().findFirst().orElse(new GlobalSetting());
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
}
