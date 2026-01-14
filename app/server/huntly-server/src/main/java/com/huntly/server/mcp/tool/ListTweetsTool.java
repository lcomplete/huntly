package com.huntly.server.mcp.tool;

import com.huntly.interfaces.external.dto.PageItem;
import com.huntly.interfaces.external.query.PageListQuery;
import com.huntly.interfaces.external.query.PageListSort;
import com.huntly.server.mcp.McpUtils;
import com.huntly.server.service.PageListService;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * MCP Tool: list_tweets - Get tweets with various sort modes
 */
@Component
public class ListTweetsTool implements McpTool {

    private final PageListService pageListService;
    private final McpUtils mcpUtils;

    public ListTweetsTool(PageListService pageListService, McpUtils mcpUtils) {
        this.pageListService = pageListService;
        this.mcpUtils = mcpUtils;
    }

    @Override
    public String getName() {
        return "list_tweets";
    }

    @Override
    public String getDescription() {
        return "Retrieve saved Twitter/X tweets with multiple sort options. IMPORTANT: Each result includes 'huntlyUrl' (Huntly's reading page) and 'url' (original tweet). When referencing content, prefer using huntlyUrl as the primary link.";
    }

    @Override
    public Map<String, Object> getInputSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();
        properties.put("mode", Map.of(
                "type", "string",
                "enum", List.of("recent_read", "popular", "recent_published", "recent_fetched"),
                "default", "recent_fetched",
                "description", "Sort mode: recent_read (recently viewed), popular (by vote score), recent_published (by publish date), recent_fetched (by system fetch time)"
        ));
        properties.put("start_date", Map.of(
                "type", "string",
                "description", "Start date filter (YYYY-MM-DD or ISO 8601)"
        ));
        properties.put("end_date", Map.of(
                "type", "string",
                "description", "End date filter (YYYY-MM-DD or ISO 8601)"
        ));
        properties.put("limit", Map.of(
                "type", "integer",
                "maximum", 500,
                "description", "Number of results to return, max 500"
        ));
        properties.put("max_description_length", Map.of(
                "type", "integer",
                "default", 200,
                "description", "Maximum tweet content length, 0 for unlimited"
        ));

        schema.put("properties", properties);
        return schema;
    }

    @Override
    public Object execute(Map<String, Object> arguments) {
        String mode = mcpUtils.getStringArg(arguments, "mode");
        if (mode == null) {
            mode = "recent_fetched";
        }
        String startDate = mcpUtils.getStringArg(arguments, "start_date");
        String endDate = mcpUtils.getStringArg(arguments, "end_date");
        int limit = mcpUtils.getIntArg(arguments, "limit", 50);
        int maxDescLen = mcpUtils.getIntArg(arguments, "max_description_length", 200);

        PageListQuery query = new PageListQuery();
        query.setContentFilterType(2); // TWEET
        query.setCount(Math.min(limit, 500));

        // Set sort based on mode
        switch (mode) {
            case "recent_read":
                query.setSort(PageListSort.LAST_READ_AT);
                break;
            case "popular":
                query.setSort(PageListSort.VOTE_SCORE);
                break;
            case "recent_published":
                query.setSort(PageListSort.CONNECTED_AT);
                break;
            case "recent_fetched":
            default:
                query.setSort(PageListSort.CREATED_AT);
                break;
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
                "mode", mode,
                "items", items.stream()
                        .map(item -> mcpUtils.toMcpTweetItem(item, maxDescLen))
                        .collect(Collectors.toList())
        );
    }
}
