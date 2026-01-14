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
        return "Get user's personal library content by category: my_list (saved items), archive (archived items), starred (favorite items), read_later (bookmarked for later reading). IMPORTANT: Each result includes 'huntlyUrl' (Huntly's reading page) and 'url' (original source). When referencing content, prefer using huntlyUrl as the primary link.";
    }

    @Override
    public Map<String, Object> getInputSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();
        properties.put("type", Map.of(
                "type", "string",
                "enum", List.of("my_list", "archive", "starred", "read_later"),
                "description", "Content category"
        ));
        properties.put("source_type", Map.of(
                "type", "string",
                "enum", List.of("all", "rss", "github", "tweet", "webpage"),
                "default", "all",
                "description", "Content source type"
        ));
        properties.put("start_date", Map.of(
                "type", "string",
                "description", "Start date (YYYY-MM-DD or ISO 8601)"
        ));
        properties.put("end_date", Map.of(
                "type", "string",
                "description", "End date (YYYY-MM-DD or ISO 8601)"
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
        schema.put("required", List.of("type"));
        return schema;
    }

    @Override
    public Object execute(Map<String, Object> arguments) {
        String type = mcpUtils.getStringArg(arguments, "type");
        String sourceType = mcpUtils.getStringArg(arguments, "source_type");
        String startDate = mcpUtils.getStringArg(arguments, "start_date");
        String endDate = mcpUtils.getStringArg(arguments, "end_date");
        int limit = mcpUtils.getIntArg(arguments, "limit", 50);
        boolean titleOnly = mcpUtils.getBoolArg(arguments, "title_only", false);
        int maxDescLen = mcpUtils.getIntArg(arguments, "max_description_length", 200);

        PageListQuery query = new PageListQuery();
        query.setCount(Math.min(limit, 500));

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
            default:
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
                        .map(item -> mcpUtils.toMcpPageItem(item, titleOnly, maxDescLen))
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
            default:
                break;
        }
    }
}
