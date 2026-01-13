package com.huntly.server.mcp.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * MCP Content Detail DTO for full content response
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class McpContentDetail {
    private Long id;
    private String title;
    private String url;
    private String huntlyUrl;
    private String author;
    private String content;
    private String description;
    private String sourceType;
    private String libraryStatus;
    private Boolean starred;
    private Boolean readLater;
    private String recordAt;
    private String createdAt;
    private Long voteScore;
    private Integer connectorId;
    private String connectorName;
}
