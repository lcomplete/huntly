package com.huntly.server.service;

import com.huntly.server.domain.entity.ArticleShortcut;
import com.huntly.server.domain.entity.GlobalSetting;
import com.openai.client.OpenAIClient;
import com.openai.client.okhttp.OpenAIOkHttpClient;
import com.openai.models.chat.completions.ChatCompletionCreateParams;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;

/**
 * Service for interacting with OpenAI API
 */
@Service
@Slf4j
public class OpenAIService {

    private final GlobalSettingService globalSettingService;
    private final ArticleShortcutService articleShortcutService;

    public OpenAIService(GlobalSettingService globalSettingService, ArticleShortcutService articleShortcutService) {
        this.globalSettingService = globalSettingService;
        this.articleShortcutService = articleShortcutService;
    }

    /**
     * Generate a summary for the given article content using the default summary shortcut
     *
     * @param content the article content to summarize
     * @return the generated summary, or null if an error occurred
     */
    public String generateArticleSummary(String content) {
        // Backward compatibility: Try to find a shortcut named "文章摘要"
        ArticleShortcut summaryShortcut = articleShortcutService.getShortcutByName("文章摘要").orElse(null);
        
        String prompt;
        // If no summary shortcut is found, use the prompt from GlobalSetting (for backward compatibility)
        if (summaryShortcut == null) {
            GlobalSetting globalSetting = globalSettingService.getGlobalSetting();
            prompt = globalSetting.getArticleSummaryPrompt();
            log.info("Using summary prompt from GlobalSetting (legacy mode)");
        } else {
            prompt = summaryShortcut.getContent();
            log.info("Using summary prompt from ArticleShortcut: {}", summaryShortcut.getName());
        }
        
        return processWithOpenAI(content, prompt);
    }
    
    /**
     * Process content using a specific article shortcut
     * 
     * @param content the content to process
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
        return processWithOpenAI(content, shortcut.getContent());
    }
    
    /**
     * Process content with the OpenAI API using the given prompt
     * 
     * @param content the content to process
     * @param prompt the system prompt to use
     * @return the processed content, or null if an error occurred
     */
    private String processWithOpenAI(String content, String prompt) {
        // 在try块外声明变量，以便在catch块中访问
        GlobalSetting globalSetting = null;
        String baseUrl = null;
        String model = null;
        String apiKey = null;
        
        try {
            globalSetting = globalSettingService.getGlobalSetting();
            baseUrl = globalSetting.getOpenApiBaseUrl();
            model = globalSetting.getOpenApiModel();
            
            // Use default model if not set
            if (StringUtils.isBlank(model)) {
                model = "gpt-4o-mini";
                log.info("Using default model: {}", model);
            }
            
            // Get API key from settings
            // It could be in the baseUrl as a token parameter or directly in the API key field
            apiKey = globalSetting.getOpenApiKey();
            
            // If API key is not directly set, try to extract it from baseUrl
            // Format could be: https://api.openai.com?token=your-api-key
            if (StringUtils.isBlank(apiKey) && StringUtils.isNotBlank(baseUrl) && baseUrl.contains("token=")) {
                String[] parts = baseUrl.split("token=");
                if (parts.length > 1) {
                    apiKey = parts[1];
                    // Remove the token from the base URL
                    baseUrl = parts[0].replaceAll("[?&]$", "");
                }
            }
            
            if (StringUtils.isBlank(apiKey)) {
                log.info("OpenAI API key not found. Please configure it in the settings.");
                return null;
            }
            
            // Create OpenAI client with the API key
            OpenAIClient client;
            
            // Configure custom base URL if provided
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
            ChatCompletionCreateParams createParams = ChatCompletionCreateParams.builder()
                    .model(model)
                    .maxCompletionTokens(2048)
                    .addSystemMessage(prompt)
                    .addUserMessage(content)
                    .build();
            
            // Execute the request and extract the content from the response
            return client.chat().completions().create(createParams).choices().stream()
                    .flatMap(choice -> choice.message().content().stream())
                    .findFirst()
                    .orElse(null);
            
        } catch (Exception e) {
            if (e.getCause() instanceof com.fasterxml.jackson.core.JsonParseException) {
                log.error("JSON parsing error when calling OpenAI API. This usually means the API returned HTML instead of JSON. " +
                        "Check your API key and base URL configuration. Error: {}", e.getCause().getMessage());
                
                // 记录配置信息以帮助诊断问题
                String apiKeyPrefix = StringUtils.isNotBlank(apiKey) ? 
                        apiKey.substring(0, Math.min(5, apiKey.length())) + "..." : "null";
                log.error("API配置 - API Key前缀: {}, Base URL: {}, Model: {}", apiKeyPrefix, baseUrl, model);
            } else {
                log.error("Error processing content with OpenAI", e);
            }
            return null;
        }
    }
}
