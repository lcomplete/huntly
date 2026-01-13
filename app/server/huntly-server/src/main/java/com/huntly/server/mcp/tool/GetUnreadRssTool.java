package com.huntly.server.mcp.tool;

import com.huntly.interfaces.external.dto.PageItem;
import com.huntly.interfaces.external.query.PageListQuery;
import com.huntly.interfaces.external.query.PageListSort;
import com.huntly.server.connector.ConnectorType;
import com.huntly.server.mcp.McpUtils;
import com.huntly.server.service.PageListService;
import org.springframework.stereotype.Component;

import java.util.HashMap;
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
        return "Get all unread articles from RSS feed subscriptions. Returns unread items sorted by fetch time (newest first). Use this to quickly check what new RSS content is available to read.";
    }

    @Override
    public Map<String, Object> getInputSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();
        properties.put("limit", Map.of(
                "type", "integer",
                "default", 50,
                "maximum", 200,
                "description", "返回结果数量限制"
        ));
        properties.put("title_only", Map.of(
                "type", "boolean",
                "default", true,
                "description", "仅返回标题和URL（默认true减少token消耗）"
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
        query.setCount(Math.min(limit, 200));
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
