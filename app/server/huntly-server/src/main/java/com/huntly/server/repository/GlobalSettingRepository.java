package com.huntly.server.repository;

import com.huntly.server.domain.entity.GlobalSetting;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

/**
 * @author lcomplete
 */
@Repository
public interface GlobalSettingRepository extends JpaRepository<GlobalSetting, Integer>, JpaSpecificationExecutor<GlobalSetting> {
    
}
