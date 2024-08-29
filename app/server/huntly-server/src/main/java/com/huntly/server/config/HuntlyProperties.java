package com.huntly.server.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * @author lcomplete
 */
@Data
@ConfigurationProperties(prefix = "huntly")
@Component
public class HuntlyProperties {
    private String jwtSecret;

    private int jwtExpirationDays;

    private boolean enableFetchThreadPool = true;

    private Integer connectorFetchCorePoolSize;
    
    private Integer connectorFetchMaxPoolSize;

    private Integer defaultFeedFetchIntervalSeconds = 600;
    
    private String luceneDir;
    
    private String dataDir;
}
