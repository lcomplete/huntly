package com.huntly.server.service;

import com.huntly.server.repository.ConnectorSettingRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class ConnectorSettingService {

    @Autowired
    private ConnectorSettingRepository connectorSettingRepository;

}
