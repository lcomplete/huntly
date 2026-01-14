package com.huntly.server.mcp.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * MCP PageItem DTO for list responses
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class McpPageItem {
    private Long id;
    private String title;
    private String url;
    private String huntlyUrl;
    private String author;
    private String description;
    /**
     * Content type: article, tweet, github
     */
    private String contentType;
    /**
     * Short content preview, used for tweets in title_only mode
     */
    private String content;
    private String sourceType;
    private String libraryStatus;
    private Boolean starred;
    private Boolean readLater;
    private Boolean markRead;
    private String recordAt;
    /**
     * Original publish time (connectedAt for tweets/RSS, pubDate for articles)
     */
    private String publishedAt;
    private Long voteScore;
    private Integer connectorId;
    private String connectorName;

    // Tweet-specific fields
    private Long favoriteCount;
    private Long retweetCount;
    private Long replyCount;
    private Long viewCount;
    private String tweetUserName;
    private String tweetUserScreenName;

    // GitHub-specific fields
    private Long stargazersCount;
    private Long forksCount;
    private Long watchersCount;
    private List<String> topics;
    private String language;
}
