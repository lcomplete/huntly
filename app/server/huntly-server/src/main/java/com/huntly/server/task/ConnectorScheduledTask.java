package com.huntly.server.task;

import com.huntly.server.service.ConnectorFetchService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * @author lcomplete
 */
@Component
@Slf4j
public class ConnectorScheduledTask {
    private final ConnectorFetchService connectorFetchService;
    
    public ConnectorScheduledTask(ConnectorFetchService connectorFetchService) {
        this.connectorFetchService = connectorFetchService;
    }

    @Scheduled(initialDelay = 1000 * 5, fixedRate = 1000 * 60)
    public void connectorFetchPages() {
        connectorFetchService.fetchAllConnectPages();
    }
}
