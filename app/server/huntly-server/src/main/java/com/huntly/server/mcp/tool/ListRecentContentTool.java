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
        return "Get recently saved content across all sources. IMPORTANT: Each result includes 'huntlyUrl' (Huntly's reading page) and 'url' (original source). When referencing content, prefer using huntlyUrl as the primary link.";
    }

    @Override
    public Map<String, Object> getInputSchema() {
        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new LinkedHashMap<>();
        properties.put("source_type", Map.of(
                "type", "string",
                "enum", List.of("all", "rss", "github", "tweet", "webpage"),
                "default", "all",
                "description", "Content source type"
        ));
        properties.put("start_date", Map.of(
                "type", "string",
                "description", "Start time (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)"
        ));
        properties.put("end_date", Map.of(
                "type", "string",
                "description", "End time (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)"
        ));
        properties.put("unread_only", Map.of(
                "type", "boolean",
                "default", false,
                "description", "Return unread items only"
        ));
        properties.put("limit", Map.of(
                "type", "integer",
                "maximum", 500,
                "description", "Number of results to return, max 500"
        ));
        properties.put("title_only", Map.of(
                "type", "boolean",
                "default", false,
                "description", "Return only title and URL to reduce token usage"
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
        int limit = mcpUtils.getIntArg(arguments, "limit", 50);
        boolean titleOnly = mcpUtils.getBoolArg(arguments, "title_only", false);

        PageListQuery query = new PageListQuery();
        query.setCount(Math.min(limit, 500));
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
                default:
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
