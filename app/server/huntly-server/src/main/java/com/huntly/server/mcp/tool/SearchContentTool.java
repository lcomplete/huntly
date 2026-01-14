package com.huntly.server.mcp.tool;

import com.huntly.interfaces.external.dto.PageSearchResult;
import com.huntly.interfaces.external.query.SearchQuery;
import com.huntly.server.mcp.McpUtils;
import com.huntly.server.service.LuceneService;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
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
        return "Full-text search across all saved content in Huntly. Supports Chinese/English tokenization. IMPORTANT: Each result includes 'huntlyUrl' (Huntly's reading page) and 'url' (original source). When referencing content, prefer using huntlyUrl as the primary link.";
    }

    @Override
    public Map<String, Object> getInputSchema() {
        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new LinkedHashMap<>();
        properties.put("query", Map.of(
                "type", "string",
                "description", "Search keywords (required, cannot be empty). Supports advanced syntax combined with keywords: 'machine learning author:openai' or 'typescript url:github.com'. Note: Must include at least one search keyword; cannot use only advanced filters like 'author:xxx' alone."
        ));
        properties.put("content_type", Map.of(
                "type", "string",
                "enum", List.of("tweet", "github", "browser", "feeds"),
                "description", "Filter by content type. tweet: Twitter/X posts, github: GitHub starred repos, browser: browser history, feeds: RSS feed articles. If not specified, searches all types."
        ));
        properties.put("library_filter", Map.of(
                "type", "string",
                "enum", List.of("list", "starred", "archive", "later", "highlights"),
                "description", "Filter by library status. list: saved to My List, starred: starred items, archive: archived items, later: read later items, highlights: items with highlights. If not specified, searches all content."
        ));
        properties.put("search_title_only", Map.of(
                "type", "boolean",
                "default", false,
                "description", "If true, only search in titles (not content). Useful for faster, more precise title matching."
        ));
        properties.put("already_read", Map.of(
                "type", "boolean",
                "default", false,
                "description", "If true, only return items that have been read."
        ));
        properties.put("limit", Map.of(
                "type", "integer",
                "maximum", 500,
                "description", "Number of results to return, max 500"
        ));
        properties.put("title_only", Map.of(
                "type", "boolean",
                "default", false,
                "description", "Return only title and URL in response to reduce token usage"
        ));

        schema.put("properties", properties);
        schema.put("required", List.of("query"));
        return schema;
    }

    @Override
    public Object execute(Map<String, Object> arguments) {
        String query = mcpUtils.getStringArg(arguments, "query");
        String contentType = mcpUtils.getStringArg(arguments, "content_type");
        String libraryFilter = mcpUtils.getStringArg(arguments, "library_filter");
        boolean searchTitleOnly = mcpUtils.getBoolArg(arguments, "search_title_only", false);
        boolean alreadyRead = mcpUtils.getBoolArg(arguments, "already_read", false);
        int limit = mcpUtils.getIntArg(arguments, "limit", 50);
        boolean titleOnly = mcpUtils.getBoolArg(arguments, "title_only", false);

        if (StringUtils.isBlank(query)) {
            return Map.of("error", "query is required and cannot be empty");
        }

        SearchQuery searchQuery = new SearchQuery();
        searchQuery.setQ(query);
        searchQuery.setSize(Math.min(limit, 500));

        // Build query options from filter parameters
        String queryOptions = buildQueryOptions(contentType, libraryFilter, searchTitleOnly, alreadyRead);
        if (StringUtils.isNotBlank(queryOptions)) {
            searchQuery.setQueryOptions(queryOptions);
        }

        PageSearchResult result = luceneService.searchPages(searchQuery);

        return Map.of(
                "total_hits", result.getTotalHits(),
                "query", query,
                "query_options", queryOptions != null ? queryOptions : "",
                "items", result.getItems().stream()
                        .map(item -> mcpUtils.toMcpPageItem(item, titleOnly))
                        .collect(Collectors.toList())
        );
    }

    /**
     * Build comma-separated query options string from filter parameters
     */
    private String buildQueryOptions(String contentType, String libraryFilter,
                                     boolean searchTitleOnly, boolean alreadyRead) {
        List<String> options = new ArrayList<>();

        // Content type filter
        if (StringUtils.isNotBlank(contentType)) {
            options.add(contentType);
        }

        // Library filter
        if (StringUtils.isNotBlank(libraryFilter)) {
            options.add(libraryFilter);
        }

        // Search options
        if (searchTitleOnly) {
            options.add("title");
        }
        if (alreadyRead) {
            options.add("read");
        }

        return options.isEmpty() ? null : String.join(",", options);
    }
}
