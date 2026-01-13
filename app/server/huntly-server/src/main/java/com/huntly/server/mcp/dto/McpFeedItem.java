package com.huntly.server.mcp.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * MCP RSS Feed item for list_rss_feeds response
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class McpFeedItem {
    private Integer id;
    private String name;
    private String subscribeUrl;
    private String iconUrl;
    private Integer folderId;
    private String folderName;
    private Integer unreadCount;
    private Boolean enabled;
}
