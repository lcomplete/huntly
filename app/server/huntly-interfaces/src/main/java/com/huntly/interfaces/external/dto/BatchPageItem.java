package com.huntly.interfaces.external.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Simplified page item for batch organize display.
 *
 * @author lcomplete
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BatchPageItem {

    /**
     * Page ID.
     */
    private Long id;

    /**
     * Content type (0: BROWSER_HISTORY, 1: TWEET, 2: MARKDOWN, 3: QUOTED_TWEET, 4: SNIPPET).
     */
    private Integer contentType;

    /**
     * Page title.
     */
    private String title;

    /**
     * Page description (truncated).
     */
    private String description;

    /**
     * Page URL.
     */
    private String url;

    /**
     * Author name.
     */
    private String author;

    /**
     * JSON properties for special content types (e.g., tweet data).
     */
    private String pageJsonProperties;

    /**
     * Collected time (when added to collection) as ISO string for frontend processing.
     */
    private Instant collectedAt;

    /**
     * Publish time (original publish date, maps to connectedAt) as ISO string.
     */
    private Instant publishTime;
}

