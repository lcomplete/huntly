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
 * MCP Tool: list_recent_content - Get recent content with time filters
 */
@Component
public class ListRecentContentTool implements McpTool {

    private final PageListService pageListService;
    private final McpUtils mcpUtils;

    public ListRecentContentTool(PageListService pageListService, McpUtils mcpUtils) {
        this.pageListService = pageListService;
        this.mcpUtils = mcpUtils;
    }

    @Override
    public String getName() {
        return "list_recent_content";
    }

    @Override
    public String getDescription() {
        return "Get recently saved content across all sources (RSS, GitHub, tweets, webpages). Supports precise date/time filtering, source type filtering, and unread-only mode. Use this to browse recent items or find content from a specific time period.";
    }

    @Override
    public Map<String, Object> getInputSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();
        properties.put("source_type", Map.of(
                "type", "string",
                "enum", List.of("all", "rss", "github", "tweet", "webpage"),
                "default", "all",
                "description", "内容来源类型"
        ));
        properties.put("start_date", Map.of(
                "type", "string",
                "description", "起始时间 (YYYY-MM-DD 或 YYYY-MM-DDTHH:mm:ss)"
        ));
        properties.put("end_date", Map.of(
                "type", "string",
                "description", "结束时间 (YYYY-MM-DD 或 YYYY-MM-DDTHH:mm:ss)"
        ));
        properties.put("unread_only", Map.of(
                "type", "boolean",
                "default", false,
                "description", "仅返回未读内容"
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
        return schema;
    }

    @Override
    public Object execute(Map<String, Object> arguments) {
        String sourceType = mcpUtils.getStringArg(arguments, "source_type");
        String startDate = mcpUtils.getStringArg(arguments, "start_date");
        String endDate = mcpUtils.getStringArg(arguments, "end_date");
        boolean unreadOnly = mcpUtils.getBoolArg(arguments, "unread_only", false);
        int limit = mcpUtils.getIntArg(arguments, "limit", 30);
        boolean titleOnly = mcpUtils.getBoolArg(arguments, "title_only", false);

        PageListQuery query = new PageListQuery();
        query.setCount(Math.min(limit, 100));
        query.setSort(PageListSort.CONNECTED_AT);

        // Apply source type filter
        if (sourceType != null && !"all".equals(sourceType)) {
            switch (sourceType) {
                case "rss":
                    query.setConnectorType(ConnectorType.RSS.getCode());
                    break;
                case "github":
                    query.setConnectorType(ConnectorType.GITHUB.getCode());
                    break;
                case "tweet":
                    query.setContentFilterType(2);
                    break;
                case "webpage":
                    query.setContentFilterType(1);
                    break;
            }
        }

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
