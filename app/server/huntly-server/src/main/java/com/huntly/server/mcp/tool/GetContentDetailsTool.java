package com.huntly.server.mcp.tool;

import com.huntly.server.domain.entity.Page;
import com.huntly.server.mcp.McpUtils;
import com.huntly.server.mcp.dto.McpPageItem;
import com.huntly.server.repository.PageRepository;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.stream.Collectors;

/**
 * MCP Tool: get_content_details - Batch get content details by IDs
 */
@Component
public class GetContentDetailsTool implements McpTool {

    private final PageRepository pageRepository;
    private final McpUtils mcpUtils;

    public GetContentDetailsTool(PageRepository pageRepository, McpUtils mcpUtils) {
        this.pageRepository = pageRepository;
        this.mcpUtils = mcpUtils;
    }

    @Override
    public String getName() {
        return "get_content_details";
    }

    @Override
    public String getDescription() {
        return "Batch retrieve content details for multiple items by their IDs (up to 50). Returns full content including description and metadata. IMPORTANT: Each result includes 'huntlyUrl' (Huntly's reading page) and 'url' (original source). When referencing content, prefer using huntlyUrl as the primary link.";
    }

    @Override
    public Map<String, Object> getInputSchema() {
        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new LinkedHashMap<>();
        properties.put("ids", Map.of(
                "type", "array",
                "items", Map.of("type", "integer"),
                "maxItems", 50,
                "description", "List of content IDs"
        ));

        schema.put("properties", properties);
        schema.put("required", List.of("ids"));
        return schema;
    }

    @Override
    public Object execute(Map<String, Object> arguments) {
        Object idsObj = arguments.get("ids");
        if (idsObj == null) {
            return Map.of("error", "ids is required");
        }

        List<Long> ids;
        if (idsObj instanceof List) {
            ids = ((List<?>) idsObj).stream()
                    .map(o -> {
                        if (o instanceof Number) {
                            return ((Number) o).longValue();
                        }
                        return Long.parseLong(o.toString());
                    })
                    .limit(50)
                    .collect(Collectors.toList());
        } else {
            return Map.of("error", "ids must be an array");
        }

        List<Page> pages = pageRepository.findAllById(ids);

        List<McpPageItem> items = pages.stream().map(page -> McpPageItem.builder()
                .id(page.getId())
                .title(page.getTitle())
                .url(page.getUrl())
                .huntlyUrl(mcpUtils.buildHuntlyUrl(page.getId()))
                .author(page.getAuthor())
                .description(page.getDescription())
                .sourceType(mcpUtils.getSourceType(page.getConnectorType(), page.getContentType()))
                .libraryStatus(mcpUtils.getLibraryStatus(page.getLibrarySaveStatus()))
                .starred(page.getStarred())
                .readLater(page.getReadLater())
                .recordAt(page.getConnectedAt() != null ? page.getConnectedAt().toString() : null)
                .voteScore(page.getVoteScore())
                .connectorId(page.getConnectorId())
                .build()
        ).collect(Collectors.toList());

        return Map.of(
                "count", items.size(),
                "items", items
        );
    }
}
