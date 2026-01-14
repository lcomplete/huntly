package com.huntly.server.mcp.tool;

import com.huntly.interfaces.external.dto.PageItem;
import com.huntly.interfaces.external.query.PageListQuery;
import com.huntly.interfaces.external.query.PageListSort;
import com.huntly.server.connector.ConnectorType;
import com.huntly.server.mcp.McpUtils;
import com.huntly.server.service.PageListService;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * MCP Tool: get_unread_rss - Get all unread RSS items
 */
@Component
public class GetUnreadRssTool implements McpTool {

    private final PageListService pageListService;
    private final McpUtils mcpUtils;

    public GetUnreadRssTool(PageListService pageListService, McpUtils mcpUtils) {
        this.pageListService = pageListService;
        this.mcpUtils = mcpUtils;
    }

    @Override
    public String getName() {
        return "get_unread_rss";
    }

    @Override
    public String getDescription() {
        return "Get all unread articles from RSS feeds (sorted by fetch time, newest first). IMPORTANT: Each result includes 'huntlyUrl' (Huntly's reading page) and 'url' (original source). When referencing content, prefer using huntlyUrl as the primary link.";
    }

    @Override
    public Map<String, Object> getInputSchema() {
        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new LinkedHashMap<>();
        properties.put("limit", Map.of(
                "type", "integer",
                "maximum", 500,
                "description", "Number of results to return, max 500"
        ));
        properties.put("title_only", Map.of(
                "type", "boolean",
                "default", true,
                "description", "Return only title and URL (default true to reduce token usage)"
        ));

        schema.put("properties", properties);
        return schema;
    }

    @Override
    public Object execute(Map<String, Object> arguments) {
        int limit = mcpUtils.getIntArg(arguments, "limit", 50);
        boolean titleOnly = mcpUtils.getBoolArg(arguments, "title_only", true);

        PageListQuery query = new PageListQuery();
        query.setConnectorType(ConnectorType.RSS.getCode());
        query.setMarkRead(false);
        query.setCount(Math.min(limit, 500));
        query.setSort(PageListSort.CONNECTED_AT);

        List<PageItem> items = pageListService.getPageItems(query);

        return Map.of(
                "count", items.size(),
                "items", items.stream()
                        .map(item -> mcpUtils.toMcpPageItem(item, titleOnly))
                        .collect(Collectors.toList())
        );
    }
}
