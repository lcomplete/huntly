package com.huntly.interfaces.external.query;

import lombok.Data;

import java.time.Instant;

/**
 * @author lcomplete
 */
@Data
public class HighlightListQuery {

    private int page;
    
    private int size;
    
    private Instant startDate;
    
    private Instant endDate;
    
    /**
     * Sort by: created_at
     */
    private String sort = "created_at";
    
    /**
     * Sort direction: asc, desc
     */
    private String direction = "desc";
}