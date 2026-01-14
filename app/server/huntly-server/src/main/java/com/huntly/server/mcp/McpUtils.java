package com.huntly.server.mcp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import com.huntly.interfaces.external.dto.PageItem;
import com.huntly.interfaces.external.model.LibrarySaveStatus;
import com.huntly.server.connector.ConnectorType;
import com.huntly.server.mcp.dto.McpPageItem;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
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
        if (isTweet(contentType)) {
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
     * Get content type string from integer content type.
     * Based on ContentType enum: BROWSER_HISTORY(0), TWEET(1), MARKDOWN(2), QUOTED_TWEET(3), SNIPPET(4)
     */
    public String getContentType(Integer contentType) {
        if (contentType == null) {
            return "article";
        }
        switch (contentType) {
            case 1: // TWEET
            case 3: // QUOTED_TWEET
                return "tweet";
            case 4: // SNIPPET
                return "snippet";
            default:
                return "article";
        }
    }

    /**
     * Check if content type is tweet.
     * ContentType.TWEET(1) or ContentType.QUOTED_TWEET(3)
     */
    public boolean isTweet(Integer contentType) {
        return contentType != null && (contentType == 1 || contentType == 3);
    }

    private static final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Convert PageItem to McpPageItem
     */
    public McpPageItem toMcpPageItem(PageItem pageItem, boolean titleOnly) {
        String contentType = getContentType(pageItem.getContentType());
        boolean isTweet = isTweet(pageItem.getContentType());
        boolean isGithub = isGithub(pageItem.getConnectorType());

        McpPageItem.McpPageItemBuilder builder = McpPageItem.builder()
                .id(pageItem.getId())
                .url(pageItem.getUrl())
                .huntlyUrl(buildHuntlyUrl(pageItem.getId()))
                .contentType(contentType);

        // For tweets, use content field instead of title; for articles, use title
        if (isTweet) {
            // Parse tweet text using the same logic as frontend Tweet.tsx
            String tweetText = TweetTextParser.extractPlainText(pageItem.getPageJsonProperties());
            if (StringUtils.isBlank(tweetText)) {
                // Fallback to description if parsing fails
                tweetText = pageItem.getDescription();
            }
            builder.content(tweetText);
            builder.author(pageItem.getAuthor());
            // Parse tweet-specific fields from pageJsonProperties
            parseTweetProperties(pageItem.getPageJsonProperties(), builder);
        } else if (isGithub) {
            builder.title(pageItem.getTitle());
            // Parse GitHub-specific fields from pageJsonProperties
            parseGithubProperties(pageItem.getPageJsonProperties(), builder);
        } else {
            builder.title(pageItem.getTitle());
        }

        if (!titleOnly) {
            builder.author(pageItem.getAuthor())
                    .description(pageItem.getDescription())
                    .sourceType(getSourceType(pageItem.getConnectorType(), pageItem.getContentType()))
                    .libraryStatus(getLibraryStatus(pageItem.getLibrarySaveStatus()))
                    .starred(pageItem.getStarred())
                    .readLater(pageItem.getReadLater())
                    .markRead(pageItem.getMarkRead())
                    .recordAt(pageItem.getRecordAt() != null ? pageItem.getRecordAt().toString() : null)
                    .publishedAt(pageItem.getConnectedAt() != null ? pageItem.getConnectedAt().toString() : null)
                    .voteScore(pageItem.getVoteScore())
                    .connectorId(pageItem.getConnectorId());

            if (isGithub) {
                builder.language(pageItem.getLanguage());
            }
        }

        return builder.build();
    }

    /**
     * Convert PageItem to McpPageItem for tweets (always includes full content)
     */
    public McpPageItem toMcpTweetItem(PageItem pageItem) {
        // Parse tweet text using the same logic as frontend Tweet.tsx
        String tweetText = TweetTextParser.extractPlainText(pageItem.getPageJsonProperties());
        if (StringUtils.isBlank(tweetText)) {
            // Fallback to description if parsing fails
            tweetText = pageItem.getDescription();
        }

        McpPageItem.McpPageItemBuilder builder = McpPageItem.builder()
                .id(pageItem.getId())
                .url(pageItem.getUrl())
                .huntlyUrl(buildHuntlyUrl(pageItem.getId()))
                .contentType("tweet")
                .content(tweetText)
                .author(pageItem.getAuthor())
                .sourceType("tweet")
                .libraryStatus(getLibraryStatus(pageItem.getLibrarySaveStatus()))
                .starred(pageItem.getStarred())
                .readLater(pageItem.getReadLater())
                .markRead(pageItem.getMarkRead())
                .recordAt(pageItem.getRecordAt() != null ? pageItem.getRecordAt().toString() : null)
                .publishedAt(pageItem.getConnectedAt() != null ? pageItem.getConnectedAt().toString() : null)
                .voteScore(pageItem.getVoteScore());

        // Parse tweet-specific fields
        parseTweetProperties(pageItem.getPageJsonProperties(), builder);

        return builder.build();
    }

    /**
     * Convert PageItem to McpPageItem for GitHub repos
     */
    public McpPageItem toMcpGithubItem(PageItem pageItem, boolean titleOnly) {
        McpPageItem.McpPageItemBuilder builder = McpPageItem.builder()
                .id(pageItem.getId())
                .url(pageItem.getUrl())
                .huntlyUrl(buildHuntlyUrl(pageItem.getId()))
                .contentType("github")
                .title(pageItem.getTitle())
                .sourceType("github")
                .libraryStatus(getLibraryStatus(pageItem.getLibrarySaveStatus()))
                .starred(pageItem.getStarred())
                .readLater(pageItem.getReadLater())
                .markRead(pageItem.getMarkRead())
                .recordAt(pageItem.getRecordAt() != null ? pageItem.getRecordAt().toString() : null)
                .publishedAt(pageItem.getConnectedAt() != null ? pageItem.getConnectedAt().toString() : null);

        if (!titleOnly) {
            builder.author(pageItem.getAuthor())
                    .description(pageItem.getDescription())
                    .language(pageItem.getLanguage())
                    .connectorId(pageItem.getConnectorId());
        }

        // Parse GitHub-specific fields
        parseGithubProperties(pageItem.getPageJsonProperties(), builder);

        return builder.build();
    }

    /**
     * Check if connector type is GitHub
     */
    public boolean isGithub(Integer connectorType) {
        return connectorType != null && connectorType.equals(ConnectorType.GITHUB.getCode());
    }

    /**
     * Convert Page entity to McpPageItem (for detailed content retrieval)
     */
    public McpPageItem toMcpPageItemFromEntity(com.huntly.server.domain.entity.Page page) {
        String contentTypeStr = getContentType(page.getContentType());
        boolean isTweet = isTweet(page.getContentType());
        boolean isGithub = isGithub(page.getConnectorType());

        McpPageItem.McpPageItemBuilder builder = McpPageItem.builder()
                .id(page.getId())
                .url(page.getUrl())
                .huntlyUrl(buildHuntlyUrl(page.getId()))
                .contentType(contentTypeStr)
                .sourceType(getSourceType(page.getConnectorType(), page.getContentType()))
                .libraryStatus(getLibraryStatus(page.getLibrarySaveStatus()))
                .starred(page.getStarred())
                .readLater(page.getReadLater())
                .markRead(page.getMarkRead())
                .recordAt(page.getConnectedAt() != null ? page.getConnectedAt().toString() : null)
                .publishedAt(page.getConnectedAt() != null ? page.getConnectedAt().toString() : null)
                .voteScore(page.getVoteScore())
                .connectorId(page.getConnectorId());

        if (isTweet) {
            // Parse tweet text using the same logic as frontend Tweet.tsx
            String tweetText = TweetTextParser.extractPlainText(page.getPageJsonProperties());
            if (StringUtils.isBlank(tweetText)) {
                tweetText = page.getDescription();
            }
            if (StringUtils.isBlank(tweetText)) {
                tweetText = page.getContent();
            }
            builder.content(tweetText);
            builder.author(page.getAuthor());
            // Parse tweet-specific fields
            parseTweetProperties(page.getPageJsonProperties(), builder);
        } else if (isGithub) {
            builder.title(page.getTitle());
            builder.author(page.getAuthor());
            builder.description(page.getDescription());
            builder.content(page.getContent());  // README content
            builder.language(page.getLanguage());
            // Parse GitHub-specific fields
            parseGithubProperties(page.getPageJsonProperties(), builder);
        } else {
            builder.title(page.getTitle());
            builder.author(page.getAuthor());
            builder.description(page.getDescription());
            builder.content(page.getContent());
        }

        return builder.build();
    }

    /**
     * Parse tweet properties from JSON and add to builder
     */
    private void parseTweetProperties(String pageJsonProperties, McpPageItem.McpPageItemBuilder builder) {
        if (StringUtils.isBlank(pageJsonProperties)) {
            return;
        }
        try {
            JsonNode node = objectMapper.readTree(pageJsonProperties);
            // Handle retweet case - get stats from the retweeted tweet
            // Must check isNull() because JSON may have "retweetedTweet": null
            JsonNode tweetNode = node.has("retweetedTweet") && !node.get("retweetedTweet").isNull()
                    ? node.get("retweetedTweet") : node;

            if (tweetNode.has("favoriteCount")) {
                builder.favoriteCount(tweetNode.get("favoriteCount").asLong());
            }
            if (tweetNode.has("retweetCount")) {
                builder.retweetCount(tweetNode.get("retweetCount").asLong());
            }
            if (tweetNode.has("replyCount")) {
                builder.replyCount(tweetNode.get("replyCount").asLong());
            }
            if (tweetNode.has("viewCount")) {
                builder.viewCount(tweetNode.get("viewCount").asLong());
            }
            if (tweetNode.has("userName")) {
                builder.tweetUserName(tweetNode.get("userName").asText());
            }
            if (tweetNode.has("userScreeName")) {
                builder.tweetUserScreenName(tweetNode.get("userScreeName").asText());
            }
        } catch (Exception e) {
            // Ignore parsing errors
        }
    }

    /**
     * Parse GitHub repo properties from JSON and add to builder
     */
    private void parseGithubProperties(String pageJsonProperties, McpPageItem.McpPageItemBuilder builder) {
        if (StringUtils.isBlank(pageJsonProperties)) {
            return;
        }
        try {
            JsonNode node = objectMapper.readTree(pageJsonProperties);

            if (node.has("stargazersCount")) {
                builder.stargazersCount(node.get("stargazersCount").asLong());
            }
            if (node.has("forksCount")) {
                builder.forksCount(node.get("forksCount").asLong());
            }
            if (node.has("watchersCount")) {
                builder.watchersCount(node.get("watchersCount").asLong());
            }
            if (node.has("topics") && node.get("topics").isArray()) {
                List<String> topics = new ArrayList<>();
                for (JsonNode topic : node.get("topics")) {
                    topics.add(topic.asText());
                }
                builder.topics(topics);
            }
        } catch (Exception e) {
            // Ignore parsing errors
        }
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
