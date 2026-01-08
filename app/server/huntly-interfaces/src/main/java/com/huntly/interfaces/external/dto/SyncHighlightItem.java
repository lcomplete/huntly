package com.huntly.interfaces.external.dto;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;

/**
 * 高亮同步项
 */
@Data
@Builder
public class SyncHighlightItem {
    
    /**
     * 高亮 ID
     */
    private Long id;
    
    /**
     * 页面 ID
     */
    private Long pageId;
    
    /**
     * 高亮文本
     */
    private String highlightedText;
    
    /**
     * 页面标题
     */
    private String pageTitle;
    
    /**
     * 页面 URL
     */
    private String pageUrl;
    
    /**
     * 页面作者
     */
    private String author;
    
    /**
     * 内容类型
     */
    private Integer contentType;
    
    /**
     * 连接器类型
     */
    private Integer connectorType;
    
    /**
     * 连接器 ID
     */
    private Integer connectorId;
    
    /**
     * 连接器名称
     */
    private String connectorName;
    
    /**
     * 文件夹 ID
     */
    private Integer folderId;
    
    /**
     * 文件夹名称
     */
    private String folderName;
    
    /**
     * 高亮创建时间
     */
    private Instant createdAt;
    
    /**
     * 高亮更新时间
     */
    private Instant updatedAt;
    
    /**
     * 页面更新时间
     */
    private Instant pageUpdatedAt;
}

