package com.huntly.server.mcp.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * MCP PageItem DTO for list responses
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class McpPageItem {
    private Long id;
    private String title;
    private String url;
    private String huntlyUrl;
    private String author;
    private String description;
    /**
     * Content type: article, tweet, github
     */
    private String contentType;
    /**
     * Short content preview, used for tweets in title_only mode
     */
    private String content;
    private String sourceType;
    private String libraryStatus;
    private Boolean starred;
    private Boolean readLater;
    private String recordAt;
    private Long voteScore;
    private Integer connectorId;
    private String connectorName;
}
