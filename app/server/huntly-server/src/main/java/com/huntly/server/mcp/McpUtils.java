package com.huntly.server.mcp;

import com.huntly.interfaces.external.dto.PageItem;
import com.huntly.interfaces.external.model.LibrarySaveStatus;
import com.huntly.server.connector.ConnectorType;
import com.huntly.server.mcp.dto.McpPageItem;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * MCP utility methods for common operations
 */
@Component
public class McpUtils {

    /**
     * Build Huntly detail page URL from current request context
     */
    public String buildHuntlyUrl(Long pageId) {
        try {
            String baseUrl = org.springframework.web.servlet.support.ServletUriComponentsBuilder
                    .fromCurrentContextPath().build().toUriString();
            return baseUrl + "/page/" + pageId;
        } catch (Exception e) {
            // Fallback if no request context (e.g. background tasks, though MCP is http
            // request driven)
            return null;
        }
    }

    /**
     * Convert connector type to source type string
     */
    public String getSourceType(Integer connectorType, Integer contentType) {
        if (contentType != null && contentType == 2) { // TWEET content type
            return "tweet";
        }
        if (connectorType == null) {
            return "webpage";
        }
        if (connectorType.equals(ConnectorType.RSS.getCode())) {
            return "rss";
        }
        if (connectorType.equals(ConnectorType.GITHUB.getCode())) {
            return "github";
        }
        return "webpage";
    }

    /**
     * Convert library save status to string
     */
    public String getLibraryStatus(Integer librarySaveStatus) {
        if (librarySaveStatus == null) {
            return null;
        }
        if (librarySaveStatus == LibrarySaveStatus.SAVED.getCode()) {
            return "my_list";
        }
        if (librarySaveStatus == LibrarySaveStatus.ARCHIVED.getCode()) {
            return "archive";
        }
        return null;
    }

    /**
     * Get content type string from integer content type
     */
    public String getContentType(Integer contentType) {
        if (contentType == null) {
            return "article";
        }
        switch (contentType) {
            case 2:
                return "tweet";
            default:
                return "article";
        }
    }

    /**
     * Check if content type is tweet
     */
    public boolean isTweet(Integer contentType) {
        return contentType != null && contentType == 2;
    }

    /**
     * Convert PageItem to McpPageItem
     */
    public McpPageItem toMcpPageItem(PageItem pageItem, boolean titleOnly) {
        return toMcpPageItem(pageItem, titleOnly, 200);
    }

    /**
     * Convert PageItem to McpPageItem with description length control
     */
    public McpPageItem toMcpPageItem(PageItem pageItem, boolean titleOnly, int maxDescLen) {
        String contentType = getContentType(pageItem.getContentType());
        boolean isTweet = isTweet(pageItem.getContentType());

        McpPageItem.McpPageItemBuilder builder = McpPageItem.builder()
                .id(pageItem.getId())
                .url(pageItem.getUrl())
                .huntlyUrl(buildHuntlyUrl(pageItem.getId()))
                .contentType(contentType);

        // For tweets, use content field instead of title; for articles, use title
        if (isTweet) {
            // Tweets don't have titles, use description as content
            builder.content(truncateText(pageItem.getDescription(), maxDescLen));
            builder.author(pageItem.getAuthor());
        } else {
            builder.title(pageItem.getTitle());
        }

        if (!titleOnly) {
            builder.author(pageItem.getAuthor())
                    .description(truncateText(pageItem.getDescription(), maxDescLen))
                    .sourceType(getSourceType(pageItem.getConnectorType(), pageItem.getContentType()))
                    .libraryStatus(getLibraryStatus(pageItem.getLibrarySaveStatus()))
                    .starred(pageItem.getStarred())
                    .readLater(pageItem.getReadLater())
                    .recordAt(pageItem.getRecordAt() != null ? pageItem.getRecordAt().toString() : null)
                    .voteScore(pageItem.getVoteScore())
                    .connectorId(pageItem.getConnectorId());
        }

        return builder.build();
    }

    /**
     * Truncate text to max length, adding ellipsis if truncated
     */
    public String truncateText(String text, int maxLen) {
        if (text == null || maxLen <= 0 || text.length() <= maxLen) {
            return text;
        }
        return text.substring(0, maxLen) + "...";
    }

    /**
     * Convert PageItem to McpPageItem for tweets (always includes content)
     */
    public McpPageItem toMcpTweetItem(PageItem pageItem) {
        return toMcpTweetItem(pageItem, 200);
    }

    /**
     * Convert PageItem to McpPageItem for tweets with content length control
     */
    public McpPageItem toMcpTweetItem(PageItem pageItem, int maxDescLen) {
        return McpPageItem.builder()
                .id(pageItem.getId())
                .url(pageItem.getUrl())
                .huntlyUrl(buildHuntlyUrl(pageItem.getId()))
                .contentType("tweet")
                .content(truncateText(pageItem.getDescription(), maxDescLen))
                .author(pageItem.getAuthor())
                .sourceType("tweet")
                .libraryStatus(getLibraryStatus(pageItem.getLibrarySaveStatus()))
                .starred(pageItem.getStarred())
                .readLater(pageItem.getReadLater())
                .recordAt(pageItem.getRecordAt() != null ? pageItem.getRecordAt().toString() : null)
                .voteScore(pageItem.getVoteScore())
                .build();
    }

    /**
     * Parse integer from arguments with default
     */
    public int getIntArg(Map<String, Object> args, String key, int defaultValue) {
        Object value = args.get(key);
        if (value == null) {
            return defaultValue;
        }
        if (value instanceof Number) {
            return ((Number) value).intValue();
        }
        try {
            return Integer.parseInt(value.toString());
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }

    /**
     * Parse boolean from arguments with default
     */
    public boolean getBoolArg(Map<String, Object> args, String key, boolean defaultValue) {
        Object value = args.get(key);
        if (value == null) {
            return defaultValue;
        }
        if (value instanceof Boolean) {
            return (Boolean) value;
        }
        return Boolean.parseBoolean(value.toString());
    }

    /**
     * Get string from arguments
     */
    public String getStringArg(Map<String, Object> args, String key) {
        Object value = args.get(key);
        return value != null ? value.toString() : null;
    }
}
