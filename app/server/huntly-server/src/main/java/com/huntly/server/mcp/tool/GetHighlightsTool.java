package com.huntly.server.mcp.tool;

import com.huntly.server.domain.entity.Page;
import com.huntly.server.domain.entity.PageHighlight;
import com.huntly.server.mcp.McpUtils;
import com.huntly.server.mcp.dto.McpHighlight;
import com.huntly.server.repository.PageHighlightRepository;
import com.huntly.server.repository.PageRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
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

    private final PageHighlightRepository highlightRepository;
    private final PageRepository pageRepository;
    private final McpUtils mcpUtils;

    public GetHighlightsTool(PageHighlightRepository highlightRepository, PageRepository pageRepository, McpUtils mcpUtils) {
        this.highlightRepository = highlightRepository;
        this.pageRepository = pageRepository;
        this.mcpUtils = mcpUtils;
    }

    @Override
    public String getName() {
        return "get_highlights";
    }

    @Override
    public String getDescription() {
        return "Get user-highlighted text passages from articles. Returns highlighted text along with source article info. IMPORTANT: Each result includes 'huntlyUrl' (Huntly's reading page for the source article). When referencing content, prefer using huntlyUrl as the primary link.";
    }

    @Override
    public Map<String, Object> getInputSchema() {
        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new LinkedHashMap<>();
        properties.put("page_id", Map.of(
                "type", "integer",
                "description", "Filter by specific article ID, omit to get all highlights"
        ));
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
        int pageId = mcpUtils.getIntArg(arguments, "page_id", 0);
        int limit = mcpUtils.getIntArg(arguments, "limit", 50);

        List<PageHighlight> highlights;
        Pageable pageable = PageRequest.of(0, Math.min(limit, 500), Sort.by(Sort.Direction.DESC, "createdAt"));

        if (pageId > 0) {
            highlights = highlightRepository.findByPageId((long) pageId, pageable);
        } else {
            highlights = highlightRepository.findAll(pageable).getContent();
        }

        List<McpHighlight> result = highlights.stream().map(h -> {
            // Get page info for context
            Page page = pageRepository.findById(h.getPageId()).orElse(null);
            return McpHighlight.builder()
                    .id(h.getId())
                    .pageId(h.getPageId())
                    .pageTitle(page != null ? page.getTitle() : null)
                    .pageUrl(page != null ? page.getUrl() : null)
                    .huntlyUrl(mcpUtils.buildHuntlyUrl(h.getPageId()))
                    .highlightedText(h.getHighlightedText())
                    .createdAt(h.getCreatedAt() != null ? h.getCreatedAt().toString() : null)
                    .build();
        }).collect(Collectors.toList());

        return Map.of(
                "count", result.size(),
                "highlights", result
        );
    }
}
