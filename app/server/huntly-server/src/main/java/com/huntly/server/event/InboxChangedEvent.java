package com.huntly.server.event;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;
import lombok.experimental.Accessors;

/**
 * @author lcomplete
 */
@Setter
@Getter
@Accessors(chain = true)
public class InboxChangedEvent {
    public InboxChangedEvent(Integer connectorId) {
        this.connectorId = connectorId;
    }

    private Integer connectorId;

    /**
     * if this data is null, will compute inbox count at time
     */
    private Integer inboxCount;
    
    
}
