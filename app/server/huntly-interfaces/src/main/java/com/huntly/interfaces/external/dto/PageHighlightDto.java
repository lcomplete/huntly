package com.huntly.interfaces.external.dto;

import lombok.Data;

import java.time.Instant;

/**
 * @author lcomplete
 */
@Data
public class PageHighlightDto {

    private Long id;

    private Long pageId;

    private String highlightedText;

    private Integer startOffset;

    private Integer endOffset;

    private Instant createdAt;
}