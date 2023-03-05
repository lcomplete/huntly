package com.huntly.interfaces.external.query;

import lombok.Getter;
import lombok.Setter;

/**
 * @author lcomplete
 */
@Setter
@Getter
public class SearchQuery {
    /**
     * keyword
     */
    private String q;
    
    private String queryOptions;
    
    private Integer page;
    
    private Integer size;
    
    //private Integer connectorId;
    
    //private Instant readAfterAt;
    
    //private Instant readBeforeAt;
}
