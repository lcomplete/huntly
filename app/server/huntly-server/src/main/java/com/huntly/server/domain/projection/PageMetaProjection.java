package com.huntly.server.domain.projection;

import java.time.Instant;

/**
 * 页面元数据投影接口 - 不包含 content 字段
 * 用于高性能同步 API 查询
 */
public interface PageMetaProjection {
    
    Long getId();
    
    String getTitle();
    
    String getUrl();
    
    String getAuthor();
    
    String getAuthorScreenName();
    
    String getDescription();
    
    Integer getConnectorType();
    
    Integer getConnectorId();
    
    Integer getFolderId();
    
    Integer getContentType();
    
    Integer getLibrarySaveStatus();
    
    Boolean getStarred();
    
    Boolean getReadLater();
    
    Instant getSavedAt();
    
    Instant getUpdatedAt();
    
    Instant getCreatedAt();
    
    Instant getLastReadAt();
    
    Instant getArchivedAt();
    
    String getThumbUrl();
    
    Integer getHighlightCount();
    
    String getPageJsonProperties();
}

