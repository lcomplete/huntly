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
 * MCP Tool: list_github_stars - Get recent GitHub stars
 */
@Component
public class ListGithubStarsTool implements McpTool {

    private final PageListService pageListService;
    private final McpUtils mcpUtils;

    public ListGithubStarsTool(PageListService pageListService, McpUtils mcpUtils) {
        this.pageListService = pageListService;
        this.mcpUtils = mcpUtils;
    }

    @Override
    public String getName() {
        return "list_github_stars";
    }

    @Override
    public String getDescription() {
        return "Get recently starred GitHub repositories synced from user's GitHub account. Returns repo name, description, URL, star count, and language. Supports date range filtering.";
    }

    @Override
    public Map<String, Object> getInputSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();
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
                "default", 50,
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
        String startDate = mcpUtils.getStringArg(arguments, "start_date");
        String endDate = mcpUtils.getStringArg(arguments, "end_date");
        int limit = mcpUtils.getIntArg(arguments, "limit", 50);
        boolean titleOnly = mcpUtils.getBoolArg(arguments, "title_only", false);

        PageListQuery query = new PageListQuery();
        query.setConnectorType(ConnectorType.GITHUB.getCode());
        query.setCount(Math.min(limit, 100));
        query.setSort(PageListSort.CONNECTED_AT);

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
