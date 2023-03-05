package com.huntly.server.event;

import com.huntly.server.service.ConnectorService;
import com.huntly.server.service.PageService;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

/**
 * @author lcomplete
 */
@Component
public class InboxChangedListener {

    private final ConnectorService connectorService;

    public InboxChangedListener(ConnectorService connectorService) {
        this.connectorService = connectorService;
    }

    @EventListener
    public void inboxChangedEvent(InboxChangedEvent event) {
        if (event.getConnectorId() != null && event.getConnectorId() > 0) {
            if (event.getInboxCount() != null) {
                connectorService.updateInboxCount(event.getConnectorId(), event.getInboxCount());
            } else {
                connectorService.updateInboxCount(event.getConnectorId());
            }
        }
    }
}
