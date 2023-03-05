package com.huntly.server.repository;

import com.huntly.server.domain.entity.TwitterUserSetting;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface TwitterUserSettingRepository extends JpaRepository<TwitterUserSetting, Integer>, JpaSpecificationExecutor<TwitterUserSetting> {
    Optional<TwitterUserSetting> findByScreenName(String screenName);
}
