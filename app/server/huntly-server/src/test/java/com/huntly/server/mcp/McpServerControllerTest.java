package com.huntly.server.mcp;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.huntly.server.domain.entity.GlobalSetting;
import com.huntly.server.mcp.tool.McpTool;
import com.huntly.server.service.GlobalSettingService;
import com.huntly.server.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.Map;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class McpServerControllerTest {

    private static final String TOKEN = "test-token";
    private static final String SESSION_ID = "session-1";

    private MockMvc mockMvc;
    private McpToolRegistry toolRegistry;
    private UserService userService;

    @BeforeEach
    void setUp() {
        toolRegistry = mock(McpToolRegistry.class);
        GlobalSettingService globalSettingService = mock(GlobalSettingService.class);
        userService = mock(UserService.class);

        GlobalSetting setting = new GlobalSetting();
        setting.setMcpToken(TOKEN);
        when(globalSettingService.getGlobalSetting()).thenReturn(setting);
        when(userService.existsByUsername("huntly-user")).thenReturn(true);

        McpServerController controller = new McpServerController(
            toolRegistry,
            globalSettingService,
            userService,
            new ObjectMapper());

        @SuppressWarnings("unchecked")
        Map<String, SseEmitter> sessions =
                (Map<String, SseEmitter>) ReflectionTestUtils.getField(controller, "sessions");
        sessions.put(SESSION_ID, new SseEmitter());

        mockMvc = MockMvcBuilders.standaloneSetup(controller).build();
    }

    @Test
    void handleMessageReturnsAcceptedForInspectorStyleAcceptHeader() throws Exception {
        mockMvc.perform(post("/api/mcp/message")
                        .param("sessionId", SESSION_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + TOKEN)
                        .accept(MediaType.APPLICATION_JSON, MediaType.TEXT_EVENT_STREAM)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\",\"params\":{}}"))
                .andExpect(status().isAccepted())
                .andExpect(content().string(""));
    }

    @Test
    void handleMessageReturnsAcceptedWhenAuthenticatedByLoginCookieContext() throws Exception {
        mockMvc.perform(post("/api/mcp/message")
                        .param("sessionId", SESSION_ID)
                        .principal(() -> "huntly-user")
                        .accept(MediaType.APPLICATION_JSON, MediaType.TEXT_EVENT_STREAM)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\",\"params\":{}}"))
                .andExpect(status().isAccepted())
                .andExpect(content().string(""));
    }

    @Test
    void getToolsRejectsUnauthenticatedRequests() throws Exception {
        mockMvc.perform(get("/api/mcp/tools"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void getToolsAllowsAuthenticatedLoginContext() throws Exception {
        mockMvc.perform(get("/api/mcp/tools")
                        .principal(() -> "huntly-user"))
                .andExpect(status().isOk());
    }

    @Test
    void getToolsRejectsPrincipalWhenUserDoesNotExistInDatabase() throws Exception {
        mockMvc.perform(get("/api/mcp/tools")
                        .principal(() -> "missing-user"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void getToolsRejectsAnonymousPrincipalWithoutUserLookup() throws Exception {
        mockMvc.perform(get("/api/mcp/tools")
                        .principal(() -> "anonymousUser"))
                .andExpect(status().isUnauthorized());

        verify(userService, never()).existsByUsername("anonymousUser");
    }

    @Test
    void testToolReturnsStructuredErrorWhenToolThrowsError() throws Exception {
        when(toolRegistry.hasTool("broken_tool")).thenReturn(true);
        when(toolRegistry.getTool("broken_tool")).thenReturn(new McpTool() {
            @Override
            public String getName() {
                return "broken_tool";
            }

            @Override
            public String getDescription() {
                return "Broken test tool";
            }

            @Override
            public Map<String, Object> getInputSchema() {
                return Map.of("type", "object");
            }

            @Override
            public Object execute(Map<String, Object> arguments) {
                throw new AssertionError("simulated tool failure");
            }
        });

        mockMvc.perform(post("/api/mcp/tools/test")
                        .principal(() -> "huntly-user")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"broken_tool\",\"arguments\":{}}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error").value("Tool execution failed: simulated tool failure"));
    }
}
