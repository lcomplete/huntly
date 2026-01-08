package com.huntly.server.domain.projection;

import java.time.Instant;

/**
 * 高亮元数据投影，用于同步 API 高性能查询
 */
public interface HighlightMetaProjection {
    
    Long getId();
    
    Long getPageId();
    
    String getHighlightedText();
    
    Instant getCreatedAt();
    
    Instant getUpdatedAt();
    
    // 关联的页面信息
    String getPageTitle();
    
    String getPageUrl();
    
    String getAuthor();
    
    Integer getContentType();
    
    Integer getConnectorType();
    
    Integer getConnectorId();
    
    Integer getFolderId();
    
    Instant getPageUpdatedAt();
}

