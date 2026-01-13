package com.huntly.server.mcp.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * MCP Highlight DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class McpHighlight {
    private Long id;
    private Long pageId;
    private String pageTitle;
    private String pageUrl;
    private String highlightedText;
    private String createdAt;
}
