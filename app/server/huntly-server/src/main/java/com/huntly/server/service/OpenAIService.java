package com.huntly.server.service;

import com.huntly.server.domain.entity.ArticleShortcut;
import com.huntly.server.domain.entity.GlobalSetting;
import com.openai.client.OpenAIClient;
import com.openai.client.okhttp.OpenAIOkHttpClient;
import com.openai.models.ChatModel;
import com.openai.models.chat.completions.ChatCompletion;
import com.openai.models.chat.completions.ChatCompletionChunk;
import com.openai.models.chat.completions.ChatCompletionCreateParams;
import com.openai.core.http.StreamResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.io.OutputStream;
import java.util.concurrent.CompletableFuture;

/**
 * Service for interacting with OpenAI API
 */
@Service
@Slf4j
public class OpenAIService {

    private final GlobalSettingService globalSettingService;
    private final ArticleShortcutService articleShortcutService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public OpenAIService(GlobalSettingService globalSettingService, ArticleShortcutService articleShortcutService) {
        this.globalSettingService = globalSettingService;
        this.articleShortcutService = articleShortcutService;
    }

    /**
     * Process content using a specific article shortcut
     *
     * @param content    the content to process
     * @param shortcutId the ID of the shortcut to use
     * @return the processed content, or null if an error occurred
     */
    public String processWithShortcut(String content, Integer shortcutId) {
        ArticleShortcut shortcut = articleShortcutService.getShortcutById(shortcutId)
                .orElseThrow(() -> new IllegalArgumentException("Shortcut not found with ID: " + shortcutId));

        if (!shortcut.getEnabled()) {
            log.warn("Attempted to use disabled shortcut: {}", shortcut.getName());
            return null;
        }

        log.info("Processing content with shortcut: {}", shortcut.getName());
        String result = processWithOpenAI(content, shortcut.getContent(), false, false, null);
        log.info("Processed content with shortcut: {}", shortcut.getName());
        return result;
    }

    /**
     * Process content using a specific article shortcut with streaming response
     *
     * @param content    the content to process
     * @param shortcutId the ID of the shortcut to use
     * @param isFastMode whether to use fast mode (only send text content)
     * @param emitter    the SSE emitter for streaming response
     */
    public void processWithShortcutStream(String content, Integer shortcutId, boolean isFastMode, SseEmitter emitter) {
        ArticleShortcut shortcut = articleShortcutService.getShortcutById(shortcutId)
                .orElseThrow(() -> new IllegalArgumentException("Shortcut not found with ID: " + shortcutId));

        if (!shortcut.getEnabled()) {
            log.warn("Attempted to use disabled shortcut: {}", shortcut.getName());
            try {
                emitter.send(SseEmitter.event().name("error").data("Shortcut is disabled"));
                emitter.complete();
            } catch (IOException e) {
                log.error("Error sending SSE error event", e);
                emitter.completeWithError(e);
            }
            return;
        }

        log.info("Processing content with shortcut (streaming, fastMode={}): {}", isFastMode, shortcut.getName());

        try {
            processWithOpenAI(content, shortcut.getContent(), true, isFastMode, emitter);
        } catch (Exception e) {
            log.error("Error in streaming processing", e);
            try {
                emitter.send(SseEmitter.event().name("error").data("Processing failed: " + e.getMessage()));
                emitter.complete();
            } catch (IOException ioException) {
                log.error("Error sending SSE error event", ioException);
                emitter.completeWithError(ioException);
            }
        }
    }

    /**
     * Process content with the OpenAI API using the given prompt
     * Supports both streaming and non-streaming modes
     *
     * @param content   the content to process
     * @param prompt    the system prompt to use
     * @param streaming whether to use streaming mode
     * @param isFastMode whether to use fast mode (only send text content) - only relevant for streaming
     * @param emitter   the SSE emitter for streaming response (required if
     *                  streaming=true)
     * @return the processed content for non-streaming mode, null for streaming mode
     */
    private String processWithOpenAI(String content, String prompt, boolean streaming, boolean isFastMode, SseEmitter emitter) {
        try {
            GlobalSetting globalSetting = globalSettingService.getGlobalSetting();
            String baseUrl = globalSetting.getOpenApiBaseUrl();
            String model = globalSetting.getOpenApiModel();
            String apiKey = globalSetting.getOpenApiKey();

            // Use default model if not set
            if (StringUtils.isBlank(model)) {
                model = "gpt-4o-mini";
                log.info("Using default model: {}", model);
            }

            // If API key is not directly set, try to extract it from baseUrl
            if (StringUtils.isBlank(apiKey) && StringUtils.isNotBlank(baseUrl) && baseUrl.contains("token=")) {
                String[] parts = baseUrl.split("token=");
                if (parts.length > 1) {
                    apiKey = parts[1];
                    // Remove the token from the base URL
                    baseUrl = parts[0].replaceAll("[?&]$", "");
                }
            }

            if (StringUtils.isBlank(apiKey)) {
                log.error("OpenAI API key not found. Please configure it in the settings.");
                if (streaming) {
                    emitter.send(SseEmitter.event().name("error").data("OpenAI API key not configured"));
                    emitter.complete();
                }
                return null;
            }

            // Create OpenAI client
            OpenAIClient client;
            if (StringUtils.isNotBlank(baseUrl)) {
                log.info("Using custom OpenAI API base URL: {}", baseUrl);
                client = OpenAIOkHttpClient.builder()
                        .apiKey(apiKey)
                        .baseUrl(baseUrl)
                        .build();
            } else {
                log.info("Using official OpenAI API with model: {}", model);
                client = OpenAIOkHttpClient.builder()
                        .apiKey(apiKey)
                        .build();
            }

            // Create the chat completion request
            ChatCompletionCreateParams.Builder paramsBuilder = ChatCompletionCreateParams.builder()
                    .model(ChatModel.of(model))
                    .addSystemMessage(prompt)
                    .addUserMessage(content);

            if (streaming) {
                // Build streaming parameters (no need to set stream=true, it's handled by
                // createStreaming method)
                ChatCompletionCreateParams streamParams = paramsBuilder.build();

                // Process streaming in async mode to avoid blocking SSE
                CompletableFuture.runAsync(() -> {
                    try {
                        // Use streaming API
                        try (StreamResponse<ChatCompletionChunk> streamResponse = client.chat().completions()
                                .createStreaming(streamParams)) {

                            // Use iterator instead of forEach to process stream chunks one by one
                            var iterator = streamResponse.stream().iterator();
                            while (iterator.hasNext()) {
                                ChatCompletionChunk chunk = iterator.next();
                                try {
                                    if (isFastMode) {
                                        // Fast mode: only send the actual content text
                                        String textContent = extractContentFromChunk(chunk);
                                        if (textContent != null && !textContent.isEmpty()) {
                                            // 使用JSON格式化文本内容，避免换行符等特殊字符导致SSE解析问题
                                            String jsonContent = objectMapper.writeValueAsString(textContent);
                                            emitter.send(SseEmitter.event().data(jsonContent));
                                            log.debug("Sent SSE text content (JSON): {}", jsonContent);
                                        }
                                    } else {
                                        // Standard mode: send full OpenAI-compatible format
                                        String chunkJson = convertChunkToJson(chunk);
                                        if (chunkJson != null) {
                                            emitter.send(SseEmitter.event().data(chunkJson));
                                            log.debug("Sent SSE chunk: {}", chunkJson.length() > 100 ? chunkJson.substring(0, 100) + "..." : chunkJson);
                                        }
                                    }
                                } catch (IOException e) {
                                    log.error("Error sending SSE chunk", e);
                                    emitter.completeWithError(e);
                                    return;
                                }
                            }
                        }

                        // Send [DONE] signal only in standard mode
                        if (!isFastMode) {
                            emitter.send(SseEmitter.event().data("[DONE]"));
                        }
                        emitter.complete();
                        log.info("SSE streaming completed successfully");

                    } catch (Exception e) {
                        log.error("Error in streaming processing", e);
                        try {
                            emitter.send(SseEmitter.event().name("error").data("Processing failed: " + e.getMessage()));
                            emitter.complete();
                        } catch (IOException ioException) {
                            log.error("Error sending SSE error event", ioException);
                            emitter.completeWithError(ioException);
                        }
                    }
                });

                return null; // No return value for streaming mode

            } else {
                // Non-streaming mode
                ChatCompletionCreateParams params = paramsBuilder.build();
                ChatCompletion chatCompletion = client.chat().completions().create(params);

                // Extract the content from the response
                return chatCompletion.choices().stream()
                        .flatMap(choice -> choice.message().content().stream())
                        .findFirst()
                        .orElse(null);
            }

        } catch (Exception e) {
            log.error("Error processing content with OpenAI", e);
            if (streaming) {
                try {
                    emitter.send(SseEmitter.event().name("error").data("Processing failed: " + e.getMessage()));
                    emitter.complete();
                } catch (IOException ioException) {
                    log.error("Error sending SSE error event", ioException);
                    emitter.completeWithError(ioException);
                }
            }
            return null;
        }
    }

    /**
     * Convert ChatCompletionChunk to OpenAI-compatible JSON format
     *
     * @param chunk the chunk to convert
     * @return JSON string representation of the chunk in OpenAI format, or null if
     *         no content
     */
    private String convertChunkToJson(ChatCompletionChunk chunk) {
        try {
            // Direct serialization without any processing
            return objectMapper.writeValueAsString(chunk);
        } catch (Exception e) {
            log.error("Error converting chunk to JSON", e);
            return "{}";
        }
    }

    /**
     * Extract text content from ChatCompletionChunk
     *
     * @param chunk the chunk to extract content from
     * @return the text content, or null if no content
     */
    private String extractContentFromChunk(ChatCompletionChunk chunk) {
        try {
            if (chunk != null && chunk.choices() != null && !chunk.choices().isEmpty()) {
                var choice = chunk.choices().get(0);
                if (choice != null && choice.delta() != null && choice.delta().content().isPresent()) {
                    return choice.delta().content().get();
                }
            }
        } catch (Exception e) {
            log.error("Error extracting content from chunk", e);
        }
        return null;
    }
}
