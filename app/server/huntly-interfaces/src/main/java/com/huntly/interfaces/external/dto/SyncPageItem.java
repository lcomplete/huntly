package com.huntly.interfaces.external.dto;

import lombok.Data;

import java.time.Instant;

/**
 * 同步用的页面摘要信息，包含 updatedAt 用于增量同步判断
 */
@Data
public class SyncPageItem {

    private Long id;

    private String title;

    private String url;

    private String author;

    private Integer connectorType;

    private Integer contentType;

    private Instant savedAt;

    private Instant updatedAt;

    private Boolean starred;

    private Boolean readLater;

    private String pageJsonProperties;

    /**
     * Markdown content generated on server for desktop sync.
     */
    private String markdown;
}
