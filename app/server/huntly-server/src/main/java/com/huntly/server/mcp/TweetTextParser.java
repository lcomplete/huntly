package com.huntly.server.mcp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.commons.lang3.StringUtils;

import java.util.*;

/**
 * Parse tweet JSON properties to extract plain text content.
 * This mirrors the logic in the frontend Tweet.tsx component.
 *
 * @author lcomplete
 */
public class TweetTextParser {

    private static final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Parse tweet JSON and extract plain text content.
     * Handles hashtags, URLs, mentions, and displayTextRange.
     *
     * @param pageJsonProperties the JSON string containing tweet properties
     * @return plain text content of the tweet, or null if parsing fails
     */
    public static String extractPlainText(String pageJsonProperties) {
        if (StringUtils.isBlank(pageJsonProperties)) {
            return null;
        }
        try {
            JsonNode node = objectMapper.readTree(pageJsonProperties);
            // Handle retweet case - get content from the retweeted tweet
            JsonNode tweetNode = node.has("retweetedTweet") && !node.get("retweetedTweet").isNull()
                    ? node.get("retweetedTweet") : node;

            return extractTextFromTweetNode(tweetNode);
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Extract plain text from a tweet JSON node.
     * This implements the same logic as frontend Tweet.tsx.
     */
    private static String extractTextFromTweetNode(JsonNode tweetNode) {
        if (!tweetNode.has("fullText")) {
            return null;
        }

        String fullText = tweetNode.get("fullText").asText();
        if (StringUtils.isBlank(fullText)) {
            return "";
        }

        // Convert string to code point array to handle emojis correctly
        List<String> fullTextArr = new ArrayList<>();
        fullText.codePoints().forEach(cp -> fullTextArr.add(new String(Character.toChars(cp))));
        int length = fullTextArr.size();

        // Get displayTextRange
        int startRange = 0;
        int endRange = length;

        // Handle noteTweet case - use full text
        boolean isNoteTweet = tweetNode.has("noteTweet") && tweetNode.get("noteTweet").asBoolean();
        if (!isNoteTweet && tweetNode.has("displayTextRange") && tweetNode.get("displayTextRange").isArray()) {
            JsonNode range = tweetNode.get("displayTextRange");
            if (range.size() >= 2) {
                startRange = range.get(0).asInt();
                endRange = Math.min(range.get(1).asInt(), length);
            }
        }

        // Build index map for replacements: index -> [endIndex, replacement]
        Map<Integer, IndexReplacement> indexMap = new TreeMap<>();

        // Handle hashtags, URLs, medias, and user mentions
        addHashtagReplacements(tweetNode, indexMap);
        addUrlReplacements(tweetNode, indexMap);
        addMediaReplacements(tweetNode, indexMap);
        addMentionReplacements(tweetNode, indexMap);

        // Build the result text (same algorithm as frontend Tweet.tsx)
        return buildResultText(fullTextArr, indexMap, startRange, endRange, length);
    }

    private static void addHashtagReplacements(JsonNode tweetNode, Map<Integer, IndexReplacement> indexMap) {
        if (tweetNode.has("hashtags") && tweetNode.get("hashtags").isArray()) {
            for (JsonNode hashtag : tweetNode.get("hashtags")) {
                if (hashtag.has("indices") && hashtag.has("text")) {
                    JsonNode indices = hashtag.get("indices");
                    if (indices.size() >= 2) {
                        int start = indices.get(0).asInt();
                        int end = indices.get(1).asInt();
                        String text = "#" + hashtag.get("text").asText();
                        indexMap.put(start, new IndexReplacement(end, text));
                    }
                }
            }
        }
    }

    private static void addUrlReplacements(JsonNode tweetNode, Map<Integer, IndexReplacement> indexMap) {
        if (tweetNode.has("urls") && tweetNode.get("urls").isArray()) {
            for (JsonNode url : tweetNode.get("urls")) {
                if (url.has("indices") && url.has("displayUrl")) {
                    JsonNode indices = url.get("indices");
                    if (indices.size() >= 2) {
                        int start = indices.get(0).asInt();
                        int end = indices.get(1).asInt();
                        String displayUrl = url.get("displayUrl").asText();
                        indexMap.put(start, new IndexReplacement(end, displayUrl));
                    }
                }
            }
        }
    }

    private static void addMediaReplacements(JsonNode tweetNode, Map<Integer, IndexReplacement> indexMap) {
        if (tweetNode.has("medias") && tweetNode.get("medias").isArray()) {
            for (JsonNode media : tweetNode.get("medias")) {
                if (media.has("indices")) {
                    JsonNode indices = media.get("indices");
                    if (indices.size() >= 2) {
                        int start = indices.get(0).asInt();
                        int end = indices.get(1).asInt();
                        indexMap.put(start, new IndexReplacement(end, ""));
                    }
                }
            }
        }
    }

    private static void addMentionReplacements(JsonNode tweetNode, Map<Integer, IndexReplacement> indexMap) {
        if (tweetNode.has("userMentions") && tweetNode.get("userMentions").isArray()) {
            for (JsonNode mention : tweetNode.get("userMentions")) {
                if (mention.has("indices") && mention.has("screenName")) {
                    JsonNode indices = mention.get("indices");
                    if (indices.size() >= 2) {
                        int start = indices.get(0).asInt();
                        int end = indices.get(1).asInt();
                        String screenName = "@" + mention.get("screenName").asText();
                        indexMap.put(start, new IndexReplacement(end, screenName));
                    }
                }
            }
        }
    }

    private static String buildResultText(List<String> fullTextArr, Map<Integer, IndexReplacement> indexMap,
                                          int startRange, int endRange, int length) {
        StringBuilder result = new StringBuilder();
        int lastIndex = 0;

        for (int index = 0; index < length; index++) {
            // Skip characters before displayTextRange
            if (index < startRange) {
                lastIndex = index + 1;
                continue;
            }

            IndexReplacement replacement = indexMap.get(index);
            if (replacement != null) {
                // Append text before this replacement
                if (index > lastIndex) {
                    result.append(String.join("", fullTextArr.subList(lastIndex, index)));
                }
                // Append the replacement
                result.append(replacement.text);
                // Skip to end of replaced range
                index = replacement.endIndex - 1;
                lastIndex = replacement.endIndex;
            }
        }

        // Append remaining text up to endRange
        if (endRange > lastIndex) {
            int finalEnd = Math.min(endRange, length);
            result.append(String.join("", fullTextArr.subList(lastIndex, finalEnd)));
        }

        return result.toString().trim();
    }

    /**
     * Helper class to store replacement info.
     */
    private static class IndexReplacement {
        final int endIndex;
        final String text;

        IndexReplacement(int endIndex, String text) {
            this.endIndex = endIndex;
            this.text = text;
        }
    }
}
