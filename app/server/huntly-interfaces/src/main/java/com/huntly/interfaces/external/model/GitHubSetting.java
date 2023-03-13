package com.huntly.interfaces.external.model;

import lombok.Getter;
import lombok.Setter;

/**
 * @author lcomplete
 */
@Getter
@Setter
public class GitHubSetting {
    private int connectorId;
    
    private String apiToken;
    
    private boolean isTokenSet;
    
    private String name;
    
    private Integer fetchIntervalMinutes;
    
    private Integer fetchPageSize;
    
    private Boolean enabled;
}
