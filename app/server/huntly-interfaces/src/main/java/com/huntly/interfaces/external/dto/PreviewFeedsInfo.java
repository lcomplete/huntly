package com.huntly.interfaces.external.dto;

import lombok.Getter;
import lombok.Setter;

/**
 * @author lcomplete
 */
@Getter
@Setter
public class PreviewFeedsInfo {
    private String title;
    
    private String description;
    
    private String siteLink;
    
    private String feedUrl;
    
    private String siteFaviconUrl;
    
    private Boolean subscribed;
}
