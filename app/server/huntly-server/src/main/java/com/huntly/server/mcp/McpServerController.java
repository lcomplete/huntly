package com.huntly.server.mcp;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.huntly.server.domain.entity.GlobalSetting;
import com.huntly.server.mcp.tool.McpTool;
import com.huntly.server.service.GlobalSettingService;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * MCP Server Controller implementing SSE transport
 * Based on MCP (Model Context Protocol) specification
 */
@Slf4j
@RestController
@RequestMapping("/api/mcp")
public class McpServerController {

    private final McpToolRegistry toolRegistry;
    private final GlobalSettingService globalSettingService;
    private final ObjectMapper objectMapper;
    private final Map<String, SseEmitter> sessions = new ConcurrentHashMap<>();

    private static final String MCP_VERSION = "2024-11-05";
    private static final String SERVER_NAME = "huntly-mcp-server";
    private static final String SERVER_VERSION = "1.0.0";

    public McpServerController(McpToolRegistry toolRegistry, GlobalSettingService globalSettingService,
            ObjectMapper objectMapper) {
        this.toolRegistry = toolRegistry;
        this.globalSettingService = globalSettingService;
        this.objectMapper = objectMapper;
    }

    /**
     * Get available MCP tools for settings UI display
     * This endpoint is accessible without MCP token (uses session auth)
     */
    @GetMapping(value = "/tools", produces = MediaType.APPLICATION_JSON_VALUE)
    public java.util.List<Map<String, Object>> getTools() {
        return toolRegistry.getToolDefinitions();
    }

    /**
     * Test endpoint to directly call an MCP tool (for settings UI testing)
     * This endpoint is accessible without MCP token (uses session auth)
     */
    @PostMapping(value = "/tools/test", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> testTool(@RequestBody Map<String, Object> request) {
        String toolName = (String) request.get("name");
        @SuppressWarnings("unchecked")
        Map<String, Object> arguments = (Map<String, Object>) request.get("arguments");

        Map<String, Object> response = new HashMap<>();

        if (toolName == null || !toolRegistry.hasTool(toolName)) {
            response.put("success", false);
            response.put("error", "Unknown tool: " + toolName);
            return ResponseEntity.badRequest().body(response);
        }

        try {
            McpTool tool = toolRegistry.getTool(toolName);
            Object result = tool.execute(arguments != null ? arguments : new HashMap<>());
            response.put("success", true);
            response.put("result", result);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error testing MCP tool: {}", toolName, e);
            response.put("success", false);
            response.put("error", e.getMessage());
            return ResponseEntity.ok(response);
        }
    }

    /**
     * SSE endpoint for MCP communication
     */
    @GetMapping(value = "/sse", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter connect(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            HttpServletResponse response) {
        if (!validateToken(authorization)) {
            log.warn("MCP SSE connection rejected: invalid or missing token");
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            SseEmitter emitter = new SseEmitter(0L);
            try {
                emitter.send(SseEmitter.event()
                        .name("error")
                        .data("{\"error\": \"Unauthorized: Invalid or missing MCP token\"}"));
                emitter.complete();
            } catch (IOException e) {
                log.error("Failed to send error message", e);
            }
            return emitter;
        }

        String sessionId = UUID.randomUUID().toString();
        SseEmitter emitter = new SseEmitter(0L); // No timeout

        sessions.put(sessionId, emitter);

        emitter.onCompletion(() -> sessions.remove(sessionId));
        emitter.onTimeout(() -> sessions.remove(sessionId));
        emitter.onError(e -> sessions.remove(sessionId));

        // Send endpoint message - just the URI as the data
        try {
            String endpointUri = "/api/mcp/message?sessionId=" + sessionId;
            emitter.send(SseEmitter.event()
                    .name("endpoint")
                    .data(endpointUri));
        } catch (IOException e) {
            log.error("Failed to send endpoint message", e);
        }

        return emitter;
    }

    /**
     * Message endpoint for JSON-RPC requests
     * Per MCP SSE specification, this endpoint should:
     * 1. Accept the message and return 202 Accepted immediately
     * 2. Send the actual JSON-RPC response via the SSE channel
     */
    @PostMapping(value = "/message", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> handleMessage(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestParam(required = false) String sessionId,
            @RequestBody Map<String, Object> request) {

        if (!validateToken(authorization)) {
            return ResponseEntity.status(401).body("Unauthorized: Invalid MCP token");
        }

        // Validate session exists
        if (sessionId == null || !sessions.containsKey(sessionId)) {
            return ResponseEntity.status(400).body("Invalid or missing session ID");
        }

        String method = (String) request.get("method");
        Object id = request.get("id");
        @SuppressWarnings("unchecked")
        Map<String, Object> params = (Map<String, Object>) request.get("params");

        Map<String, Object> response = new HashMap<>();
        response.put("jsonrpc", "2.0");
        response.put("id", id);

        try {
            Object result = handleMethod(method, params);
            response.put("result", result);
        } catch (Exception e) {
            log.error("Error handling MCP method: {}", method, e);
            Map<String, Object> error = new HashMap<>();
            error.put("code", -32603);
            error.put("message", e.getMessage());
            response.put("error", error);
        }

        // Send response via SSE channel (this is the correct behavior per MCP spec)
        try {
            sendEvent(sessions.get(sessionId), "message", response);
        } catch (IOException e) {
            log.error("Failed to send SSE response", e);
            return ResponseEntity.status(500).body("Failed to send response via SSE");
        }

        // Return 202 Accepted with simple text body per MCP SSE specification
        return ResponseEntity.accepted().body("Accepted");
    }

    private Object handleMethod(String method, Map<String, Object> params) {
        switch (method) {
            case "initialize":
                return handleInitialize(params);
            case "tools/list":
                return handleToolsList();
            case "tools/call":
                return handleToolCall(params);
            default:
                throw new IllegalArgumentException("Unknown method: " + method);
        }
    }

    private Map<String, Object> handleInitialize(Map<String, Object> params) {
        Map<String, Object> result = new HashMap<>();
        result.put("protocolVersion", MCP_VERSION);

        Map<String, Object> serverInfo = new HashMap<>();
        serverInfo.put("name", SERVER_NAME);
        serverInfo.put("version", SERVER_VERSION);
        result.put("serverInfo", serverInfo);

        Map<String, Object> capabilities = new HashMap<>();
        capabilities.put("tools", Map.of("listChanged", false));
        result.put("capabilities", capabilities);

        return result;
    }

    private Map<String, Object> handleToolsList() {
        Map<String, Object> result = new HashMap<>();
        result.put("tools", toolRegistry.getToolDefinitions());
        return result;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> handleToolCall(Map<String, Object> params) {
        String toolName = (String) params.get("name");
        Map<String, Object> arguments = (Map<String, Object>) params.get("arguments");

        if (!toolRegistry.hasTool(toolName)) {
            throw new IllegalArgumentException("Unknown tool: " + toolName);
        }

        McpTool tool = toolRegistry.getTool(toolName);
        Object result = tool.execute(arguments != null ? arguments : new HashMap<>());

        Map<String, Object> response = new HashMap<>();
        try {
            String content = objectMapper.writeValueAsString(result);
            response.put("content", java.util.List.of(Map.of(
                    "type", "text",
                    "text", content)));
        } catch (JsonProcessingException e) {
            response.put("content", java.util.List.of(Map.of(
                    "type", "text",
                    "text", result.toString())));
        }
        response.put("isError", false);

        return response;
    }

    private void sendEvent(SseEmitter emitter, String eventName, Object data) throws IOException {
        String jsonData = objectMapper.writeValueAsString(data);
        emitter.send(SseEmitter.event()
                .name(eventName)
                .data(jsonData));
    }

    private boolean validateToken(String authorization) {
        GlobalSetting setting = globalSettingService.getGlobalSetting();
        String configuredToken = setting.getMcpToken();

        // If no token configured, allow access (for development)
        if (StringUtils.isBlank(configuredToken)) {
            return true;
        }

        if (StringUtils.isBlank(authorization)) {
            return false;
        }

        // Support "Bearer <token>" format
        String token = authorization.startsWith("Bearer ")
                ? authorization.substring(7)
                : authorization;

        return configuredToken.equals(token);
    }
}
