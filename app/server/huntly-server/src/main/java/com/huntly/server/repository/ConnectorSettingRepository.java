package com.huntly.server.repository;

import com.huntly.server.domain.entity.ConnectorSetting;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;

public interface ConnectorSettingRepository extends JpaRepository<ConnectorSetting, Integer>, JpaSpecificationExecutor<ConnectorSetting> {
    public List<ConnectorSetting> findAllByConnectorId(Integer connectorId);
}