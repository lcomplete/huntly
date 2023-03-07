package com.huntly.server.config;

import lombok.Data;
import lombok.Getter;
import lombok.Setter;
import org.springframework.beans.factory.annotation.Value;
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
}
