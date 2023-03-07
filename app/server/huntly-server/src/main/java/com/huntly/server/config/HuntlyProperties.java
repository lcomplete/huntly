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

    private Integer connectorFetchCorePoolSize;
    
    private Integer connectorFetchMaxPoolSize;
    
    private String luceneDir;
    
    private String dataDir;
}
