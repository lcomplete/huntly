package com.huntly.server.mcp.tool;

import com.huntly.server.domain.vo.CollectionGroupVO;
import com.huntly.server.domain.vo.CollectionTreeVO;
import com.huntly.server.domain.vo.CollectionVO;
import com.huntly.server.service.CollectionService;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * MCP Tool: list_collections - List collection tree for navigation
 */
@Component
public class ListCollectionsTool implements McpTool {

    private final CollectionService collectionService;

    public ListCollectionsTool(CollectionService collectionService) {
        this.collectionService = collectionService;
    }

    @Override
    public String getName() {
        return "list_collections";
    }

    @Override
    public String getDescription() {
        return "List Huntly collection groups and collections with page counts. Use this to discover collection IDs before calling list_collection_content, or to find collection names for search_content queries like collection:\"Daily Reads\".";
    }

    @Override
    public Map<String, Object> getInputSchema() {
        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("type", "object");
        schema.put("properties", new LinkedHashMap<>());
        return schema;
    }

    @Override
    public Object execute(Map<String, Object> arguments) {
        CollectionTreeVO tree = collectionService.getTree();

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("unsorted_count", tree.getUnsortedCount());
        response.put("groups", tree.getGroups().stream()
                .map(this::toGroupResponse)
                .collect(Collectors.toList()));
        return response;
    }

    private Map<String, Object> toGroupResponse(CollectionGroupVO group) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("id", group.getId());
        response.put("name", group.getName());
        response.put("icon", group.getIcon());
        response.put("color", group.getColor());
        response.put("display_sequence", group.getDisplaySequence());
        response.put("collections", group.getCollections().stream()
                .map(this::toCollectionResponse)
                .collect(Collectors.toList()));
        return response;
    }

    private Map<String, Object> toCollectionResponse(CollectionVO collection) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("id", collection.getId());
        response.put("group_id", collection.getGroupId());
        response.put("parent_id", collection.getParentId());
        response.put("name", collection.getName());
        response.put("icon", collection.getIcon());
        response.put("color", collection.getColor());
        response.put("display_sequence", collection.getDisplaySequence());
        response.put("page_count", collection.getPageCount());
        response.put("children", collection.getChildren().stream()
                .map(this::toCollectionResponse)
                .collect(Collectors.toList()));
        return response;
    }
}
