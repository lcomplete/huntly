package com.huntly.server.mcp;

import com.huntly.server.mcp.tool.McpTool;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Registry for all MCP tools
 */
@Component
public class McpToolRegistry {

    private final Map<String, McpTool> tools = new HashMap<>();

    public McpToolRegistry(List<McpTool> toolList) {
        toolList.forEach(tool -> tools.put(tool.getName(), tool));
    }

    public McpTool getTool(String name) {
        return tools.get(name);
    }

    public List<Map<String, Object>> getToolDefinitions() {
        return tools.values().stream()
                .map(tool -> {
                    Map<String, Object> def = new HashMap<>();
                    def.put("name", tool.getName());
                    def.put("description", tool.getDescription());
                    def.put("inputSchema", tool.getInputSchema());
                    return def;
                })
                .collect(Collectors.toList());
    }

    public boolean hasTool(String name) {
        return tools.containsKey(name);
    }
}
