package com.huntly.server.service;

import com.google.common.collect.Lists;
import com.huntly.server.domain.entity.TwitterUserSetting;
import com.huntly.server.repository.TwitterUserSettingRepository;
import org.springframework.beans.BeanUtils;
import org.springframework.stereotype.Service;

import javax.swing.text.html.Option;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * @author lcomplete
 */
@Service
public class TwitterUserSettingService {
    private final TwitterUserSettingRepository settingRepository;

    public TwitterUserSettingService(TwitterUserSettingRepository settingRepository) {
        this.settingRepository = settingRepository;
    }

    public void save(List<TwitterUserSetting> settings) {
        // todo verify settings
        List<TwitterUserSetting> existingSettings = getTwitterUserSettings();
        List<TwitterUserSetting> toSaveSettings = Lists.newArrayList();
        for (TwitterUserSetting setting : settings) {
            Optional<TwitterUserSetting> existingSetting = setting.getId() != null ?
                    existingSettings.stream().filter(s -> s.getId().equals(setting.getId())).findFirst() :
                    Optional.empty();
            var toSave = existingSetting.orElse(setting);
            if (existingSetting.isEmpty()) {
                toSave.setCreatedAt(Instant.now());
            } else {
                BeanUtils.copyProperties(setting, toSave, "id", "createdAt", "updatedAt");
            }
            toSave.setUpdatedAt(Instant.now());
            settingRepository.save(toSave);
            toSaveSettings.add(toSave);
        }
        // delete removed settings
        for (TwitterUserSetting existingSetting : existingSettings) {
            if (!toSaveSettings.contains(existingSetting)) {
                settingRepository.delete(existingSetting);
            }
        }
    }

    public List<TwitterUserSetting> getTwitterUserSettings() {
        return settingRepository.findAll();
    }
}
