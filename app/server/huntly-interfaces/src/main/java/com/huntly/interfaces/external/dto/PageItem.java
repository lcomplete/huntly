package com.huntly.interfaces.external.dto;

import lombok.Data;

import java.time.Instant;

/**
 * @author lcomplete
 */
@Data
public class PageItem {

    private Long id;

    private Integer sourceId;
    
    private Integer connectorId;
    
    private Integer connectorType;
    
    private Integer folderId;

    private String title;

    private String url;

    private String pageUniqueId;

    private String pubDate;

    private String description;

    private String author;

    private String language;

    private String category;

    private Integer readCount;

    /**
     * not row create time, but the operation time.
     */
    private Instant recordAt;

    private Instant connectedAt;

    private Integer librarySaveStatus;

    private Boolean starred;

    private Boolean readLater;

    private Boolean markRead;

    private String thumbUrl;
    
    private Integer contentType;

    private String pageJsonProperties;
    
    private Integer highlightCount;

    /**
     * Collection ID the page belongs to. Null means Unsorted.
     */
    private Long collectionId;

    //region source

    private String siteName;

    private String domain;

    private String faviconUrl;

    private Long voteScore;

    //endregion

}
