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
        return "Full-text search across all saved content in Huntly (articles, tweets, GitHub repos, webpages). Supports Chinese/English tokenization. Advanced syntax: title:xxx, author:xxx, site:xxx. Use this to find specific content by keywords.";
    }

    @Override
    public Map<String, Object> getInputSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();
        properties.put("query", Map.of(
                "type", "string",
                "description", "搜索关键词，支持高级语法: title:xxx, author:xxx, site:xxx"
        ));
        properties.put("source_type", Map.of(
                "type", "string",
                "enum", List.of("all", "rss", "github", "tweet", "webpage"),
                "default", "all",
                "description", "内容来源类型"
        ));
        properties.put("limit", Map.of(
                "type", "integer",
                "default", 20,
                "maximum", 50,
                "description", "返回结果数量限制"
        ));
        properties.put("title_only", Map.of(
                "type", "boolean",
                "default", false,
                "description", "仅返回标题和URL，减少token消耗"
        ));

        schema.put("properties", properties);
        schema.put("required", List.of("query"));
        return schema;
    }

    @Override
    public Object execute(Map<String, Object> arguments) {
        String query = mcpUtils.getStringArg(arguments, "query");
        String sourceType = mcpUtils.getStringArg(arguments, "source_type");
        int limit = mcpUtils.getIntArg(arguments, "limit", 20);
        boolean titleOnly = mcpUtils.getBoolArg(arguments, "title_only", false);

        SearchQuery searchQuery = new SearchQuery();
        searchQuery.setQ(query);
        searchQuery.setSize(Math.min(limit, 50));

        // Add source type filter to query options if needed
        if (sourceType != null && !"all".equals(sourceType)) {
            String queryOptions = buildQueryOptions(sourceType);
            searchQuery.setQueryOptions(queryOptions);
        }

        PageSearchResult result = luceneService.searchPages(searchQuery);

        return Map.of(
                "total_hits", result.getTotalHits(),
                "items", result.getItems().stream()
                        .map(item -> mcpUtils.toMcpPageItem(item, titleOnly))
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
