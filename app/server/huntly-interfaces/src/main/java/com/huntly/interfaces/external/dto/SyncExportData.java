package com.huntly.interfaces.external.dto;

import lombok.Data;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * 同步导出数据
 * 包含所有分类的导出项和目录索引
 */
@Data
public class SyncExportData {
    
    /**
     * 导出项列表
     */
    private List<SyncExportItem> items;
    
    /**
     * 目录索引映射
     * Key: 相对目录路径 (如 "Saved", "Feeds/1-Tech/2-HackerNews")
     * Value: 该目录下的索引数据
     */
    private Map<String, DirectoryIndex> directoryIndexes;
    
    /**
     * 同步时间戳
     */
    private Instant syncAt;
    
    /**
     * 是否增量同步
     */
    private boolean incremental;
    
    /**
     * 目录索引数据
     */
    @Data
    public static class DirectoryIndex {
        /**
         * 目录路径
         */
        private String path;
        
        /**
         * 目录名称
         */
        private String name;
        
        /**
         * 同步分类
         */
        private SyncCategory category;
        
        /**
         * 文件索引列表
         */
        private List<FileIndexEntry> files;
        
        /**
         * 最后更新时间
         */
        private Instant lastUpdatedAt;
    }
    
    /**
     * 文件索引条目
     */
    @Data
    public static class FileIndexEntry {
        private Long id;
        private String filename;
        private String contentTypeLabel;
        private String url;
        private String title;
        private String author;
        private String authorScreenName;
        private String description;
        private Integer connectorType;
        private Integer connectorId;
        private String connectorName;
        private Integer folderId;
        private String folderName;
        private Integer contentType;
        private Instant savedAt;
        private Instant updatedAt;
        private Instant createdAt;
        private Instant lastReadAt;
        private Boolean starred;
        private Boolean readLater;
        private Integer librarySaveStatus;
        private Integer highlightCount;
        private String pageJsonProperties;
    }
}

