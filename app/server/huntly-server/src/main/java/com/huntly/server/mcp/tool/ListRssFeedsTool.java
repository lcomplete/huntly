package com.huntly.server.mcp.tool;

import com.huntly.server.connector.ConnectorType;
import com.huntly.server.domain.entity.Connector;
import com.huntly.server.domain.entity.Folder;
import com.huntly.server.mcp.dto.McpFeedItem;
import com.huntly.server.repository.ConnectorRepository;
import com.huntly.server.repository.FolderRepository;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * MCP Tool: list_rss_feeds - List all RSS subscriptions
 */
@Component
public class ListRssFeedsTool implements McpTool {

    private final ConnectorRepository connectorRepository;
    private final FolderRepository folderRepository;

    public ListRssFeedsTool(ConnectorRepository connectorRepository, FolderRepository folderRepository) {
        this.connectorRepository = connectorRepository;
        this.folderRepository = folderRepository;
    }

    @Override
    public String getName() {
        return "list_rss_feeds";
    }

    @Override
    public String getDescription() {
        return "List all RSS feed subscriptions with statistics. Returns feed name, URL, folder, unread count, and enabled status. Use this to discover available RSS sources or get connector_id for use with list_rss_items.";
    }

    @Override
    public Map<String, Object> getInputSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");
        // No arguments needed strictly, but keep structure
        Map<String, Object> properties = new HashMap<>();
        schema.put("properties", properties);
        return schema;
    }

    @Override
    public Object execute(Map<String, Object> arguments) {
        // Fetch all RSS connectors
        List<Connector> connectors = connectorRepository.findByType(ConnectorType.RSS.getCode());

        // Fetch all folders for name mapping
        Map<Integer, String> folderMap = folderRepository.findAll().stream()
                .collect(Collectors.toMap(Folder::getId, Folder::getName));

        List<McpFeedItem> feeds = connectors.stream()
                .map(connector -> {
                    String folderName = null;
                    if (connector.getFolderId() != null) {
                        folderName = folderMap.get(connector.getFolderId());
                    }

                    return McpFeedItem.builder()
                            .id(connector.getId())
                            .name(connector.getName())
                            .subscribeUrl(connector.getSubscribeUrl())
                            .iconUrl(connector.getIconUrl())
                            .folderId(connector.getFolderId())
                            .folderName(folderName)
                            .unreadCount(connector.getInboxCount())
                            .enabled(connector.getEnabled())
                            .build();
                })
                .collect(Collectors.toList());

        return Map.of(
                "count", feeds.size(),
                "feeds", feeds);
    }
}
