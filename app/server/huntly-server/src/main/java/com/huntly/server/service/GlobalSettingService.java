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
        defaultSetting.setArticleSummaryPrompt(getDefaultArticleSummaryPrompt());
        var setting = settingRepository.findAll().stream().findFirst().orElse(defaultSetting);
        if (setting.getColdDataKeepDays() == null || setting.getColdDataKeepDays() <= 0) {
            setting.setColdDataKeepDays(AppConstants.DEFAULT_COLD_DATA_KEEP_DAYS);
        }
        // API key masking has been moved to controller layer
        // set default article summary prompt if not set
        if (StringUtils.isBlank(setting.getArticleSummaryPrompt())) {
            setting.setArticleSummaryPrompt(getDefaultArticleSummaryPrompt());
        }
        return setting;
    }
    
    private String getDefaultArticleSummaryPrompt() {
        return "你是一个专业的文章摘要生成助手，能够生成高质量的中文摘要。请按照以下要求生成摘要：\n"
            + "1. 包含文章的主要观点和关键信息\n"
            + "2. 保持客观，不添加个人观点\n"
            + "3. 结构清晰，语言简洁\n"
            + "4. 长度尽量短，但不能太短以至于丢失重点内容，不能超过原文的一半长";
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
        dbSetting.setAutoSaveSiteBlacklists(globalSetting.getAutoSaveSiteBlacklists());
        dbSetting.setOpenApiBaseUrl(globalSetting.getOpenApiBaseUrl());
        dbSetting.setOpenApiModel(globalSetting.getOpenApiModel());
        dbSetting.setArticleSummaryPrompt(globalSetting.getArticleSummaryPrompt());
        dbSetting.setMarkReadOnScroll(globalSetting.getMarkReadOnScroll());
        if (Boolean.TRUE.equals(globalSetting.getChangedOpenApiKey())) {
            dbSetting.setOpenApiKey(globalSetting.getOpenApiKey());
        }
        dbSetting.setUpdatedAt(globalSetting.getUpdatedAt());
        return settingRepository.save(dbSetting);
    }
}
