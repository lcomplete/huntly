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
 * MCP Tool: list_rss_items - Get RSS items by connector ID
 */
@Component
public class ListRssItemsTool implements McpTool {

    private final PageListService pageListService;
    private final McpUtils mcpUtils;

    public ListRssItemsTool(PageListService pageListService, McpUtils mcpUtils) {
        this.pageListService = pageListService;
        this.mcpUtils = mcpUtils;
    }

    @Override
    public String getName() {
        return "list_rss_items";
    }

    @Override
    public String getDescription() {
        return "Get articles from a specific RSS feed subscription by connector_id. First call list_rss_feeds to get available connector IDs. Supports filtering by read status and date range.";
    }

    @Override
    public Map<String, Object> getInputSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();
        properties.put("connector_id", Map.of(
                "type", "integer",
                "description", "RSS 源 ID"
        ));
        properties.put("unread_only", Map.of(
                "type", "boolean",
                "default", false,
                "description", "仅返回未读内容"
        ));
        properties.put("start_date", Map.of(
                "type", "string",
                "description", "起始日期"
        ));
        properties.put("end_date", Map.of(
                "type", "string",
                "description", "结束日期"
        ));
        properties.put("limit", Map.of(
                "type", "integer",
                "default", 30,
                "maximum", 100,
                "description", "返回结果数量限制"
        ));
        properties.put("title_only", Map.of(
                "type", "boolean",
                "default", false,
                "description", "仅返回标题和URL"
        ));

        schema.put("properties", properties);
        schema.put("required", List.of("connector_id"));
        return schema;
    }

    @Override
    public Object execute(Map<String, Object> arguments) {
        int connectorId = mcpUtils.getIntArg(arguments, "connector_id", 0);
        boolean unreadOnly = mcpUtils.getBoolArg(arguments, "unread_only", false);
        String startDate = mcpUtils.getStringArg(arguments, "start_date");
        String endDate = mcpUtils.getStringArg(arguments, "end_date");
        int limit = mcpUtils.getIntArg(arguments, "limit", 30);
        boolean titleOnly = mcpUtils.getBoolArg(arguments, "title_only", false);

        if (connectorId <= 0) {
            return Map.of("error", "Invalid connector_id");
        }

        PageListQuery query = new PageListQuery();
        query.setConnectorId(connectorId);
        query.setCount(Math.min(limit, 100));
        query.setSort(PageListSort.CONNECTED_AT);

        if (unreadOnly) {
            query.setMarkRead(false);
        }
        if (startDate != null) {
            query.setStartDate(startDate);
        }
        if (endDate != null) {
            query.setEndDate(endDate);
        }

        List<PageItem> items = pageListService.getPageItems(query);

        return Map.of(
                "count", items.size(),
                "items", items.stream()
                        .map(item -> mcpUtils.toMcpPageItem(item, titleOnly))
                        .collect(Collectors.toList())
        );
    }
}
