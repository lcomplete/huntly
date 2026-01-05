package com.huntly.interfaces.external.dto;

/**
 * 同步分类枚举
 * 用于区分不同类型的内容导出到不同目录
 */
public enum SyncCategory {
    /**
     * Library 中保存的内容 (librarySaveStatus = SAVED or ARCHIVED)
     */
    SAVED("Saved"),
    
    /**
     * Twitter/X 内容 (contentType = TWEET or QUOTED_TWEET)
     */
    X("X"),
    
    /**
     * GitHub starred repos (connectorType = GITHUB)
     */
    GITHUB("Github"),
    
    /**
     * RSS Feeds 内容 (connectorType = RSS)
     * 子目录结构: Feeds/{folderId}-{folderName}/{connectorId}-{connectorName}/
     */
    FEEDS("Feeds"),
    
    /**
     * 最近阅读的内容 (按 lastReadAt 排序，最多 200 条)
     */
    RECENTLY_READ("RecentlyRead"),
    
    /**
     * 有高亮的页面
     */
    HIGHLIGHTS("Highlights");
    
    private final String directoryName;
    
    SyncCategory(String directoryName) {
        this.directoryName = directoryName;
    }
    
    public String getDirectoryName() {
        return directoryName;
    }
}

