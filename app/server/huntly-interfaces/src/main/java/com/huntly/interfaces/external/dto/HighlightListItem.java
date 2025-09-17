package com.huntly.interfaces.external.dto;

import lombok.Data;

import java.time.Instant;

/**
 * @author lcomplete
 */
@Data
public class HighlightListItem {

    private Long id;

    private Long pageId;

    private String highlightedText;

    private Integer startOffset;

    private Integer endOffset;

    private Instant createdAt;

    // 最少的页面信息，用于跳转
    private String pageTitle;
    
    private String pageUrl;
}