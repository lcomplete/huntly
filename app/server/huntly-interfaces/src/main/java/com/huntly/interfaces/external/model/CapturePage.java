package com.huntly.interfaces.external.model;

import lombok.Data;

import javax.validation.constraints.NotBlank;
import java.time.Instant;

/**
 * @author lcomplete
 */
@Data
public class CapturePage {
    private Integer id;
    
    private String title;
    
    private String content;
    
    @NotBlank
    private String url;

    /**
     * base url for page link img url, if null then use url
     */
    private String baseUrl;
    
    private String thumbUrl;
    
    private Boolean needFindThumbUrl;
    
    private String description;
    
    private String author;
    
    private String language;
    
    private String category;
    
    private Boolean isLiked;
    private Boolean isFavorite;
    
    @NotBlank
    private String domain;
    
    private String siteName;
    
    private String faviconUrl;
    
    private String homeUrl;
    
    private String subscribeUrl;
    
    //private CaptureFromType captureFrom = CaptureFromType.BROWSER;

    /**
     * null or 0 means from browser
     */
    private Integer connectorId;
    
    private Instant connectedAt;
    
    private String pageJsonProperties;
}
