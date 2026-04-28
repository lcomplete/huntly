package com.huntly.server.mcp.tool;

import com.huntly.interfaces.external.dto.PageItem;
import com.huntly.interfaces.external.model.LibrarySaveStatus;
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
 * MCP Tool: list_collection_content - List content in a collection or Unsorted
 */
@Component
public class ListCollectionContentTool implements McpTool {

    private final PageListService pageListService;
    private final McpUtils mcpUtils;

    public ListCollectionContentTool(PageListService pageListService, McpUtils mcpUtils) {
        this.pageListService = pageListService;
        this.mcpUtils = mcpUtils;
    }

    @Override
    public String getName() {
        return "list_collection_content";
    }

    @Override
    public String getDescription() {
        return "List content saved in a specific Huntly collection or in Unsorted. Use list_collections first to discover collection_id values. Use search_content with collection:\"Name With Spaces\" when you need keyword search within a collection; use this tool when you want to browse collection contents by saved order.";
    }

    @Override
    public Map<String, Object> getInputSchema() {
        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new LinkedHashMap<>();
        properties.put("collection_id", Map.of(
                "type", "integer",
                "description", "Collection ID from list_collections. Required unless unsorted is true."
        ));
        properties.put("unsorted", Map.of(
                "type", "boolean",
                "default", false,
                "description", "If true, list saved items that are not assigned to any collection. Do not combine with collection_id."
        ));
        properties.put("source_type", Map.of(
                "type", "string",
                "enum", List.of("all", "rss", "github", "tweet", "webpage"),
                "default", "all",
                "description", "Optional source filter."
        ));
        properties.put("start_date", Map.of(
                "type", "string",
                "description", "Start date filter (YYYY-MM-DD or ISO 8601). Uses collection time for collections and saved time for Unsorted."
        ));
        properties.put("end_date", Map.of(
                "type", "string",
                "description", "End date filter (YYYY-MM-DD or ISO 8601). Uses collection time for collections and saved time for Unsorted."
        ));
        properties.put("limit", Map.of(
                "type", "integer",
                "minimum", 1,
                "maximum", 500,
                "description", "Number of results to return, max 500"
        ));
        properties.put("title_only", Map.of(
                "type", "boolean",
                "default", false,
                "description", "Return only compact fields to reduce token usage"
        ));

        schema.put("properties", properties);
        return schema;
    }

    @Override
    public Object execute(Map<String, Object> arguments) {
        Long collectionId = getLongArg(arguments, "collection_id");
        boolean unsorted = mcpUtils.getBoolArg(arguments, "unsorted", false);
        String sourceType = mcpUtils.getStringArg(arguments, "source_type");
        String startDate = mcpUtils.getStringArg(arguments, "start_date");
        String endDate = mcpUtils.getStringArg(arguments, "end_date");
        int limit = Math.min(Math.max(mcpUtils.getIntArg(arguments, "limit", 50), 1), 500);
        boolean titleOnly = mcpUtils.getBoolArg(arguments, "title_only", false);

        if (unsorted && collectionId != null) {
            return Map.of("error", "Use either collection_id or unsorted, not both");
        }
        if (!unsorted && collectionId == null) {
            return Map.of("error", "collection_id is required unless unsorted is true");
        }

        PageListQuery query = new PageListQuery();
        query.setCount(limit);
        query.setSaveStatus(LibrarySaveStatus.SAVED);
        query.setIncludeArchived(true);

        if (unsorted) {
            query.setFilterUnsorted(true);
            query.setSort(PageListSort.UNSORTED_SAVED_AT);
        } else {
            query.setCollectionId(collectionId);
            query.setSort(PageListSort.COLLECTED_AT);
        }

        applySourceTypeFilter(query, sourceType);

        if (startDate != null) {
            query.setStartDate(startDate);
        }
        if (endDate != null) {
            query.setEndDate(endDate);
        }

        List<PageItem> items = pageListService.getPageItems(query);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("count", items.size());
        response.put("collection_id", collectionId);
        response.put("unsorted", unsorted);
        response.put("items", items.stream()
                .map(item -> mcpUtils.toMcpPageItem(item, titleOnly))
                .collect(Collectors.toList()));
        return response;
    }

    private Long getLongArg(Map<String, Object> arguments, String key) {
        Object value = arguments.get(key);
        if (value == null) {
            return null;
        }
        if (value instanceof Number) {
            return ((Number) value).longValue();
        }
        return Long.parseLong(value.toString());
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
                query.setContentFilterType(2);
                break;
            case "webpage":
                query.setContentFilterType(1);
                break;
            default:
                break;
        }
    }
}
