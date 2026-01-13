package com.huntly.server.mcp.tool;

import com.huntly.server.domain.vo.PageDetail;
import com.huntly.server.mcp.McpUtils;
import com.huntly.server.mcp.dto.McpContentDetail;
import com.huntly.server.service.PageService;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * MCP Tool: get_content_detail - Get full content detail
 */
@Component
public class GetContentDetailTool implements McpTool {

    private final PageService pageService;
    private final McpUtils mcpUtils;

    public GetContentDetailTool(PageService pageService, McpUtils mcpUtils) {
        this.pageService = pageService;
        this.mcpUtils = mcpUtils;
    }

    @Override
    public String getName() {
        return "get_content_detail";
    }

    @Override
    public String getDescription() {
        return "Get complete content details including full article text by content ID. Use this when you need to read, summarize, or analyze the full content of an article, tweet, or webpage. Returns title, author, full content, metadata, and library status.";
    }

    @Override
    public Map<String, Object> getInputSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();
        properties.put("id", Map.of(
                "type", "integer",
                "description", "内容ID"));

        schema.put("properties", properties);
        schema.put("required", List.of("id"));
        return schema;
    }

    @Override
    public Object execute(Map<String, Object> arguments) {
        int id = mcpUtils.getIntArg(arguments, "id", 0);
        if (id <= 0) {
            return Map.of("error", "Invalid id");
        }

        PageDetail detail = pageService.getPageDetail((long) id);
        if (detail == null || detail.getPage() == null) {
            return Map.of("error", "Content not found");
        }

        var page = detail.getPage();

        // Get content - prefer article content if available
        String content = page.getContent();
        if (detail.getPageContents() != null && !detail.getPageContents().isEmpty()) {
            content = detail.getPageContents().get(0).getContent();
        }

        return McpContentDetail.builder()
                .id(page.getId())
                .title(page.getTitle())
                .url(page.getUrl())
                .huntlyUrl(mcpUtils.buildHuntlyUrl(page.getId()))
                .author(page.getAuthor())
                .content(content)
                .description(page.getDescription())
                .sourceType(mcpUtils.getSourceType(page.getConnectorType(), page.getContentType()))
                .libraryStatus(mcpUtils.getLibraryStatus(page.getLibrarySaveStatus()))
                .starred(page.getStarred())
                .readLater(page.getReadLater())
                .recordAt(page.getConnectedAt() != null ? page.getConnectedAt().toString() : null)
                .createdAt(page.getCreatedAt() != null ? page.getCreatedAt().toString() : null)
                .voteScore(page.getVoteScore())
                .connectorId(page.getConnectorId())
                .connectorName(detail.getConnector() != null ? detail.getConnector().getName() : null)
                .build();
    }
}
