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

    private String contentType;

    private String libraryFilter;

    private Boolean alreadyRead;

    private Boolean searchTitleOnly;

    private String startDate;

    private String endDate;

    private String dateField;
    
    private Integer page;
    
    private Integer size;
    
    //private Integer connectorId;
    
    //private Instant readAfterAt;
    
    //private Instant readBeforeAt;
}
