package com.huntly.server.mcp;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.huntly.server.domain.entity.GlobalSetting;
import com.huntly.server.service.GlobalSettingService;
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
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class McpServerControllerTest {

    private static final String TOKEN = "test-token";
    private static final String SESSION_ID = "session-1";

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        McpToolRegistry toolRegistry = mock(McpToolRegistry.class);
        GlobalSettingService globalSettingService = mock(GlobalSettingService.class);

        GlobalSetting setting = new GlobalSetting();
        setting.setMcpToken(TOKEN);
        when(globalSettingService.getGlobalSetting()).thenReturn(setting);

        McpServerController controller = new McpServerController(toolRegistry, globalSettingService, new ObjectMapper());

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
}
