package com.huntly.interfaces.external.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * 轻量级同步元数据 DTO
 * 只包含必要的元数据字段，不包含 content 和 markdown
 * 用于高性能同步列表查询
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SyncItemMeta {

    private Long id;

    private String title;

    private String url;

    private String author;

    private String authorScreenName;

    private String description;

    private Integer connectorType;

    private Integer connectorId;

    /**
     * Connector 名称（用于 Feeds 目录）
     */
    private String connectorName;

    private Integer folderId;

    /**
     * Folder 名称（用于 Feeds 目录）
     */
    private String folderName;

    private Integer contentType;

    private Integer librarySaveStatus;

    private Boolean starred;

    private Boolean readLater;

    private Instant savedAt;

    private Instant updatedAt;

    private Instant createdAt;

    private Instant lastReadAt;

    private Instant archivedAt;

    private String thumbUrl;

    /**
     * 高亮数量
     */
    private Integer highlightCount;

    /**
     * 页面JSON属性
     */
    private String pageJsonProperties;
}

