package com.huntly.server.mcp.tool;

import com.huntly.interfaces.external.dto.HighlightListItem;
import com.huntly.interfaces.external.query.HighlightListQuery;
import com.huntly.server.mcp.McpUtils;
import com.huntly.server.mcp.dto.McpHighlight;
import com.huntly.server.service.PageHighlightService;
import org.springframework.data.domain.Page;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * MCP Tool: get_highlights - Get user highlights
 */
@Component
public class GetHighlightsTool implements McpTool {

    private final PageHighlightService pageHighlightService;
    private final McpUtils mcpUtils;

    public GetHighlightsTool(PageHighlightService pageHighlightService, McpUtils mcpUtils) {
        this.pageHighlightService = pageHighlightService;
        this.mcpUtils = mcpUtils;
    }

    @Override
    public String getName() {
        return "get_highlights";
    }

    @Override
    public String getDescription() {
        return "Get user-highlighted text passages from articles. Returns highlighted text along with source article info, sorted by creation time (newest first). IMPORTANT: Each result includes 'huntlyUrl' (Huntly's reading page for the source article). When referencing content, prefer using huntlyUrl as the primary link.";
    }

    @Override
    public Map<String, Object> getInputSchema() {
        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new LinkedHashMap<>();
        properties.put("limit", Map.of(
                "type", "integer",
                "maximum", 500,
                "description", "Number of results to return, max 500"
        ));

        schema.put("properties", properties);
        return schema;
    }

    @Override
    public Object execute(Map<String, Object> arguments) {
        int limit = mcpUtils.getIntArg(arguments, "limit", 50);

        // Use the same service method as the frontend highlights page
        HighlightListQuery query = new HighlightListQuery();
        query.setPage(0);
        query.setSize(Math.min(limit, 500));
        query.setSort("created_at");
        query.setDirection("desc");

        Page<HighlightListItem> highlightPage = pageHighlightService.getHighlightList(query);

        List<McpHighlight> result = highlightPage.getContent().stream().map(h ->
            McpHighlight.builder()
                    .id(h.getId())
                    .pageId(h.getPageId())
                    .pageTitle(h.getPageTitle())
                    .pageUrl(h.getPageUrl())
                    .huntlyUrl(mcpUtils.buildHuntlyUrl(h.getPageId()))
                    .highlightedText(h.getHighlightedText())
                    .createdAt(h.getCreatedAt() != null ? h.getCreatedAt().toString() : null)
                    .build()
        ).collect(Collectors.toList());

        return Map.of(
                "count", result.size(),
                "total", highlightPage.getTotalElements(),
                "highlights", result
        );
    }
}
