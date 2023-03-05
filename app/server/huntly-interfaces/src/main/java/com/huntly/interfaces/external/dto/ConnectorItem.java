package com.huntly.interfaces.external.dto;

import lombok.Data;

/**
 * @author lcomplete
 */
@Data
public class ConnectorItem {
    private Integer id;
    
    private String name;
    
    private Integer type;
    
    private String iconUrl;
    
    private int inboxCount;
}
