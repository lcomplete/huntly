package com.huntly.interfaces.external.model;

import lombok.Getter;
import lombok.Setter;

/**
 * @author lcomplete
 */
@Getter
@Setter
public class FeedsSetting {
    private Integer connectorId;
    
    private Integer folderId;
    
    private String name;

    private Boolean crawlFullContent;
    
    private String subscribeUrl;

    private Integer fetchIntervalMinutes;
    
    private Boolean enabled;
}
