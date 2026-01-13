package com.huntly.server.mcp.tool;

import com.huntly.interfaces.external.dto.PageItem;
import com.huntly.interfaces.external.model.LibrarySaveStatus;
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
 * MCP Tool: get_library_content - Get library content (my_list/archive/starred/read_later)
 */
@Component
public class GetLibraryContentTool implements McpTool {

    private final PageListService pageListService;
    private final McpUtils mcpUtils;

    public GetLibraryContentTool(PageListService pageListService, McpUtils mcpUtils) {
        this.pageListService = pageListService;
        this.mcpUtils = mcpUtils;
    }

    @Override
    public String getName() {
        return "get_library_content";
    }

    @Override
    public String getDescription() {
        return "Get user's personal library content by category: my_list (saved items), archive (archived items), starred (favorite items), read_later (bookmarked for later reading). Supports filtering by source type and date range.";
    }

    @Override
    public Map<String, Object> getInputSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();
        properties.put("type", Map.of(
                "type", "string",
                "enum", List.of("my_list", "archive", "starred", "read_later"),
                "description", "内容类型"
        ));
        properties.put("source_type", Map.of(
                "type", "string",
                "enum", List.of("all", "rss", "github", "tweet", "webpage"),
                "default", "all",
                "description", "内容来源类型"
        ));
        properties.put("start_date", Map.of(
                "type", "string",
                "description", "起始日期 (YYYY-MM-DD 或 ISO 8601)"
        ));
        properties.put("end_date", Map.of(
                "type", "string",
                "description", "结束日期 (YYYY-MM-DD 或 ISO 8601)"
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
        schema.put("required", List.of("type"));
        return schema;
    }

    @Override
    public Object execute(Map<String, Object> arguments) {
        String type = mcpUtils.getStringArg(arguments, "type");
        String sourceType = mcpUtils.getStringArg(arguments, "source_type");
        String startDate = mcpUtils.getStringArg(arguments, "start_date");
        String endDate = mcpUtils.getStringArg(arguments, "end_date");
        int limit = mcpUtils.getIntArg(arguments, "limit", 30);
        boolean titleOnly = mcpUtils.getBoolArg(arguments, "title_only", false);

        PageListQuery query = new PageListQuery();
        query.setCount(Math.min(limit, 100));

        // Set library type filter
        switch (type) {
            case "my_list":
                query.setSaveStatus(LibrarySaveStatus.SAVED);
                query.setSort(PageListSort.SAVED_AT);
                break;
            case "archive":
                query.setSaveStatus(LibrarySaveStatus.ARCHIVED);
                query.setSort(PageListSort.ARCHIVED_AT);
                break;
            case "starred":
                query.setStarred(true);
                query.setSort(PageListSort.STARRED_AT);
                break;
            case "read_later":
                query.setReadLater(true);
                query.setSort(PageListSort.READ_LATER_AT);
                break;
        }

        // Set source type filter
        applySourceTypeFilter(query, sourceType);

        // Set date filter
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

    private void applySourceTypeFilter(PageListQuery query, String sourceType) {
        if (sourceType == null || "all".equals(sourceType)) {
            return;
        }
        switch (sourceType) {
            case "rss":
                query.setConnectorType(ConnectorType.RSS.getCode());
                break;
            case "github":
                query.setConnectorType(ConnectorType.GITHUB.getCode());
                break;
            case "tweet":
                query.setContentFilterType(2); // TWEET
                break;
            case "webpage":
                query.setContentFilterType(1); // ARTICLE (non-tweet)
                break;
        }
    }
}
