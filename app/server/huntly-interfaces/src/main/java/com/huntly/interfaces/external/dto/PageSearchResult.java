package com.huntly.interfaces.external.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

/**
 * @author lcomplete
 */
@Setter
@Getter
public class PageSearchResult {
    private List<PageItem> items;
    
    private double costSeconds;
    
    private long totalHits;
    
    private Integer page;
}
