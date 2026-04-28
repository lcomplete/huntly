package com.huntly.server.mcp.tool;

import com.huntly.interfaces.external.dto.PageSearchResult;
import com.huntly.interfaces.external.query.SearchQuery;
import com.huntly.server.mcp.McpUtils;
import com.huntly.server.service.LuceneService;
import com.huntly.server.util.PageSizeUtils;
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

    private static final int MAX_LIMIT = PageSizeUtils.MAX_PAGE_SIZE;
    private static final int MAX_LUCENE_RESULT_WINDOW = 10_000;
    private static final int MAX_PAGE = Math.max(1, MAX_LUCENE_RESULT_WINDOW / MAX_LIMIT);

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
        return "Full-text search across all saved content in Huntly. Use this when you have keywords, topics, authors, URLs, collection names, or date ranges and want relevance-ranked results. Supports Chinese/English tokenization and advanced syntax in query: url:{pattern}, author:{name}, collection:{name}. Wrap advanced values that contain spaces in quotes, for example collection:\"Daily Reads\" or author:\"Jane Doe\"; escape quotes inside quoted values with backslash. Use start_date/end_date with date_field for time filtering. Results are sorted by relevance, with title matches weighted higher than content matches. IMPORTANT: Each result includes 'huntlyUrl' (Huntly's reading page) and 'url' (original source). When referencing content, prefer using huntlyUrl as the primary link.";
    }

    @Override
    public Map<String, Object> getInputSchema() {
        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new LinkedHashMap<>();
        properties.put("query", Map.of(
                "type", "string",
                "description", "Search keywords (required, cannot be empty). Supports advanced syntax: url:{pattern}, author:{name}, collection:{name}. Combine syntax with keywords, for example 'machine learning author:openai', 'typescript url:github.com', or 'notes collection:\"Daily Reads\"'. Wrap values containing spaces in double quotes, and escape quotes inside quoted values with backslash."
        ));
        properties.put("content_type", Map.of(
                "type", "string",
                "enum", List.of("tweet", "github", "browser", "feeds"),
                "description", "Filter by content type. tweet: Twitter/X posts, github: GitHub starred repos, browser: browser history, feeds: RSS feed articles. If not specified, searches all types."
        ));
        properties.put("library_filter", Map.of(
                "type", "string",
                "enum", List.of("list", "starred", "archive", "later", "highlights", "unsorted"),
                "description", "Filter by library status. list: saved to My List, starred: starred items, archive: archived items, later: read later items, highlights: items with highlights, unsorted: saved items not assigned to any collection. If not specified, searches all content."
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
        properties.put("start_date", Map.of(
                "type", "string",
                "description", "Start date/time filter (YYYY-MM-DD or ISO 8601). Uses date_field to choose which indexed timestamp to filter."
        ));
        properties.put("end_date", Map.of(
                "type", "string",
                "description", "End date/time filter (YYYY-MM-DD or ISO 8601). Date-only values include the whole day."
        ));
        properties.put("date_field", Map.of(
                "type", "string",
                "enum", List.of("created_at", "collected_at", "last_read_at"),
                "default", "created_at",
                "description", "Timestamp field used by start_date/end_date. created_at: saved/fetched time, collected_at: collection assignment time, last_read_at: last read time."
        ));
        properties.put("limit", Map.of(
                "type", "integer",
                "minimum", 1,
                "maximum", MAX_LIMIT,
                "description", "Number of results to return, max 500"
        ));
        properties.put("page", Map.of(
                "type", "integer",
                "minimum", 1,
                "maximum", MAX_PAGE,
                "default", 1,
                "description", "Page number for search results, starting from 1. Use with limit to inspect additional pages. Capped to " + MAX_PAGE + " so Lucene collection stays bounded when limit is at its maximum."
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
        String startDate = mcpUtils.getStringArg(arguments, "start_date");
        String endDate = mcpUtils.getStringArg(arguments, "end_date");
        String dateField = mcpUtils.getStringArg(arguments, "date_field");
        int limit = Math.min(Math.max(mcpUtils.getIntArg(arguments, "limit", 50), 1), MAX_LIMIT);
        int page = Math.min(Math.max(mcpUtils.getIntArg(arguments, "page", 1), 1), MAX_PAGE);
        boolean titleOnly = mcpUtils.getBoolArg(arguments, "title_only", false);

        if (StringUtils.isBlank(query)) {
            return Map.of("error", "query is required and cannot be empty");
        }

        SearchQuery searchQuery = new SearchQuery();
        searchQuery.setQ(query);
        searchQuery.setPage(page);
        searchQuery.setSize(limit);
        searchQuery.setContentType(contentType);
        searchQuery.setLibraryFilter(libraryFilter);
        searchQuery.setSearchTitleOnly(searchTitleOnly);
        searchQuery.setAlreadyRead(alreadyRead);
        searchQuery.setStartDate(startDate);
        searchQuery.setEndDate(endDate);
        searchQuery.setDateField(dateField);

        // Build query options from filter parameters
        String queryOptions = buildQueryOptions(contentType, libraryFilter, searchTitleOnly, alreadyRead);
        if (StringUtils.isNotBlank(queryOptions)) {
            searchQuery.setQueryOptions(queryOptions);
        }

        PageSearchResult result = luceneService.searchPages(searchQuery);

        long totalHits = result.getTotalHits();
        int resultPage = result.getPage() != null ? result.getPage() : page;
        long totalPages = totalHits == 0 ? 0 : (totalHits + limit - 1) / limit;

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("total_hits", totalHits);
        response.put("page", resultPage);
        response.put("page_size", limit);
        response.put("total_pages", totalPages);
        response.put("has_more", totalPages > resultPage);
        response.put("cost_seconds", result.getCostSeconds());
        response.put("query", query);
        response.put("query_options", queryOptions != null ? queryOptions : "");
        response.put("items", result.getItems().stream()
                .map(item -> mcpUtils.toMcpPageItem(item, titleOnly))
                .collect(Collectors.toList()));

        return response;
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
