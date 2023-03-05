package com.huntly.server.connector;

import com.huntly.server.domain.model.ProxySetting;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

/**
 * @author lcomplete
 */
@Getter
@Setter
public class ConnectorProperties {
    private Instant lastFetchAt;
    
    private String subscribeUrl;
    
    private String apiToken;

    private Boolean crawlFullContent;
    
    private ProxySetting proxySetting;
}
