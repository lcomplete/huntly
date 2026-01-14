package com.huntly.server.mcp.tool;

import com.huntly.interfaces.external.dto.PageSearchResult;
import com.huntly.interfaces.external.query.SearchQuery;
import com.huntly.server.mcp.McpUtils;
import com.huntly.server.service.LuceneService;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * MCP Tool: search_content - Full text search across all content
 */
@Component
public class SearchContentTool implements McpTool {

    private final LuceneService luceneService;
    private final McpUtils mcpUtils;

    public SearchContentTool(LuceneService luceneService, McpUtils mcpUtils) {
        this.luceneService = luceneService;
        this.mcpUtils = mcpUtils;
    }

    @Override
    public String getName() {
        return "search_content";
    }

    @Override
    public String getDescription() {
        return "Full-text search across all saved content in Huntly. Supports Chinese/English tokenization and advanced syntax: title:xxx, author:xxx, site:xxx. IMPORTANT: Each result includes 'huntlyUrl' (Huntly's reading page) and 'url' (original source). When referencing content, prefer using huntlyUrl as the primary link.";
    }

    @Override
    public Map<String, Object> getInputSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();
        properties.put("query", Map.of(
                "type", "string",
                "description", "Search keywords, supports advanced syntax: title:xxx, author:xxx, site:xxx"
        ));
        properties.put("source_type", Map.of(
                "type", "string",
                "enum", List.of("all", "rss", "github", "tweet", "webpage"),
                "default", "all",
                "description", "Content source type"
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
        schema.put("required", List.of("query"));
        return schema;
    }

    @Override
    public Object execute(Map<String, Object> arguments) {
        String query = mcpUtils.getStringArg(arguments, "query");
        String sourceType = mcpUtils.getStringArg(arguments, "source_type");
        int limit = mcpUtils.getIntArg(arguments, "limit", 50);
        boolean titleOnly = mcpUtils.getBoolArg(arguments, "title_only", false);
        int maxDescLen = mcpUtils.getIntArg(arguments, "max_description_length", 200);

        SearchQuery searchQuery = new SearchQuery();
        searchQuery.setQ(query);
        searchQuery.setSize(Math.min(limit, 500));

        // Add source type filter to query options if needed
        if (sourceType != null && !"all".equals(sourceType)) {
            String queryOptions = buildQueryOptions(sourceType);
            searchQuery.setQueryOptions(queryOptions);
        }

        PageSearchResult result = luceneService.searchPages(searchQuery);

        return Map.of(
                "total_hits", result.getTotalHits(),
                "items", result.getItems().stream()
                        .map(item -> mcpUtils.toMcpPageItem(item, titleOnly, maxDescLen))
                        .collect(Collectors.toList())
        );
    }

    private String buildQueryOptions(String sourceType) {
        switch (sourceType) {
            case "rss":
                return "source:rss";
            case "github":
                return "source:github";
            case "tweet":
                return "source:tweet";
            case "webpage":
                return "source:webpage";
            default:
                return null;
        }
    }
}
