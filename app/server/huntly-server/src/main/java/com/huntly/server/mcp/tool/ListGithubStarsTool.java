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
        return "Get recently starred GitHub repositories synced from user's GitHub account. IMPORTANT: Each result includes 'huntlyUrl' (Huntly's reading page) and 'url' (GitHub repo URL). When referencing content, prefer using huntlyUrl as the primary link.";
    }

    @Override
    public Map<String, Object> getInputSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();
        properties.put("start_date", Map.of(
                "type", "string",
                "description", "Start date"
        ));
        properties.put("end_date", Map.of(
                "type", "string",
                "description", "End date"
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
        properties.put("max_description_length", Map.of(
                "type", "integer",
                "default", 200,
                "description", "Maximum description length, 0 for unlimited"
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
        int maxDescLen = mcpUtils.getIntArg(arguments, "max_description_length", 200);

        PageListQuery query = new PageListQuery();
        query.setConnectorType(ConnectorType.GITHUB.getCode());
        query.setCount(Math.min(limit, 500));
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
                        .map(item -> mcpUtils.toMcpPageItem(item, titleOnly, maxDescLen))
                        .collect(Collectors.toList())
        );
    }
}
