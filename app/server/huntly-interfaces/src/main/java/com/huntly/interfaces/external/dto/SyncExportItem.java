package com.huntly.interfaces.external.dto;

import lombok.Data;
import java.time.Instant;
import java.util.List;

/**
 * 同步导出项
 * 包含文件路径、内容和索引数据
 */
@Data
public class SyncExportItem {
    
    /**
     * 页面 ID
     */
    private Long id;
    
    /**
     * 同步分类
     */
    private SyncCategory category;
    
    /**
     * 相对目录路径 (如 "Feeds/1-Tech/2-HackerNews")
     */
    private String relativePath;
    
    /**
     * 文件名 (如 "12345-page-My Article Title.md")
     */
    private String filename;
    
    /**
     * 内容类型: "x" 或 "page"
     */
    private String contentTypeLabel;
    
    /**
     * Markdown 内容
     */
    private String markdown;
    
    /**
     * 页面 URL
     */
    private String url;
    
    /**
     * 标题
     */
    private String title;
    
    /**
     * 作者
     */
    private String author;
    
    /**
     * 作者 screen name (用于 Twitter)
     */
    private String authorScreenName;
    
    /**
     * 描述
     */
    private String description;
    
    /**
     * 连接器类型 (1=RSS, 2=GitHub)
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
     * 内容类型 (0=BROWSER_HISTORY, 1=TWEET, 2=MARKDOWN, 3=QUOTED_TWEET, 4=SNIPPET)
     */
    private Integer contentType;
    
    /**
     * 保存时间
     */
    private Instant savedAt;
    
    /**
     * 更新时间
     */
    private Instant updatedAt;
    
    /**
     * 创建时间
     */
    private Instant createdAt;
    
    /**
     * 最后阅读时间
     */
    private Instant lastReadAt;
    
    /**
     * 是否收藏
     */
    private Boolean starred;
    
    /**
     * 是否稍后阅读
     */
    private Boolean readLater;
    
    /**
     * 库保存状态 (1=SAVED, 2=ARCHIVED)
     */
    private Integer librarySaveStatus;
    
    /**
     * 高亮列表 (用于 Highlights 分类)
     */
    private List<HighlightInfo> highlights;
    
    /**
     * 页面 JSON 属性 (推特详情等)
     */
    private String pageJsonProperties;
    
    @Data
    public static class HighlightInfo {
        private Long id;
        private String text;
        private Instant createdAt;
    }
}

