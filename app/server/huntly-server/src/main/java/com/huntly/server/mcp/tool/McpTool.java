package com.huntly.server.mcp.tool;

import java.util.Map;

/**
 * Interface for MCP Tools
 */
public interface McpTool {
    /**
     * Get the tool name
     */
    String getName();

    /**
     * Get the tool description
     */
    String getDescription();

    /**
     * Get the input schema as JSON Schema
     */
    Map<String, Object> getInputSchema();

    /**
     * Execute the tool with given arguments
     */
    Object execute(Map<String, Object> arguments);
}
