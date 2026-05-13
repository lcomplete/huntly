package com.huntly.server.connector.twitter;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.huntly.interfaces.external.model.InterceptTweets;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class TweetParserTest {
    
    String getTestJsonData() throws IOException {
        ClassLoader classLoader=getClass().getClassLoader();
        try (var stream = classLoader.getResourceAsStream("tweet_timeline.json")) {
            assert stream != null;
            var bytes = stream.readAllBytes();
            return new String(bytes, StandardCharsets.UTF_8);
        }
    }

    @Test
    void tweetsToPages() throws IOException {
        InterceptTweets interceptTweets= new InterceptTweets();
        interceptTweets.setCategory("timeline");
        interceptTweets.setJsonData(getTestJsonData());
        TweetParser tweetParser = new TweetParser();
        var pages= tweetParser.tweetsToPages(interceptTweets);
        System.out.println(pages.size());
        assertThat(pages).hasSizeGreaterThanOrEqualTo(30);
    }

    @Test
    void tweetsToPagesUsesUserCoreWhenLegacyUserMissing() throws JsonProcessingException {
        InterceptTweets interceptTweets = new InterceptTweets();
        interceptTweets.setCategory("timeline");
        interceptTweets.setJsonData(timelineJson(List.of(
                timelineTweetEntry("2054479261462040687", coreOnlyUser(), true),
                unavailableTweetEntry(),
                cursorEntry()
        )));

        TweetParser tweetParser = new TweetParser();
        var pages = tweetParser.tweetsToPages(interceptTweets);

        assertThat(pages).hasSize(1);
        assertThat(pages.get(0).getPage().getUrl()).isEqualTo("https://x.com/core_user/status/2054479261462040687");
        assertThat(pages.get(0).getTweetProperties().getUserName()).isEqualTo("Core User");
        assertThat(pages.get(0).getTweetProperties().getUserScreeName()).isEqualTo("core_user");
        assertThat(pages.get(0).getTweetProperties().getUserProfileImageUrl()).isEqualTo("https://example.com/avatar.jpg");
    }

    @Test
    void tweetsToPagesFallsBackToCanonicalUrlWhenScreenNameMissing() throws JsonProcessingException {
        InterceptTweets interceptTweets = new InterceptTweets();
        interceptTweets.setCategory("timeline");
        interceptTweets.setJsonData(timelineJson(List.of(
                timelineTweetEntry("2054479261462040688", legacyUserWithoutScreenName(), false)
        )));

        TweetParser tweetParser = new TweetParser();
        var pages = tweetParser.tweetsToPages(interceptTweets);

        assertThat(pages).hasSize(1);
        assertThat(pages.get(0).getPage().getUrl()).isEqualTo("https://x.com/i/web/status/2054479261462040688");
    }

    @Test
    void tweetsToPagesHandlesObjectCardBindingValues() throws JsonProcessingException {
        InterceptTweets interceptTweets = new InterceptTweets();
        interceptTweets.setCategory("timeline");
        interceptTweets.setJsonData(timelineJson(List.of(
                timelineTweetEntryWithObjectCard("2054479261462040689")
        )));

        TweetParser tweetParser = new TweetParser();
        var pages = tweetParser.tweetsToPages(interceptTweets);

        assertThat(pages).hasSize(1);
        assertThat(pages.get(0).getTweetProperties().getCard()).isNotNull();
        assertThat(pages.get(0).getTweetProperties().getCard().getUrl()).isEqualTo("https://t.co/card");
        assertThat(pages.get(0).getTweetProperties().getCard().getTitle()).isEqualTo("Card title");
        assertThat(pages.get(0).getTweetProperties().getCard().getImageUrl()).isEqualTo("https://example.com/card.jpg");
    }

    private String timelineJson(List<Map<String, Object>> entries) throws JsonProcessingException {
        Map<String, Object> root = map("data", map("home", map("home_timeline_urt", map("instructions", List.of(
                map("type", "TimelineAddEntries", "entries", entries)
        )))));
        return new ObjectMapper().writeValueAsString(root);
    }

    private Map<String, Object> timelineTweetEntry(String tweetId, Map<String, Object> userResult, boolean wrapped) {
        Map<String, Object> tweet = tweetResult(tweetId, userResult);
        Map<String, Object> result = wrapped ? map("__typename", "TweetWithVisibilityResults", "tweet", tweet) : tweet;
        return timelineTweetEntryFromResult(tweetId, result);
    }

    private Map<String, Object> timelineTweetEntryWithObjectCard(String tweetId) {
        Map<String, Object> tweet = tweetResult(tweetId, coreOnlyUser());
        tweet.put("card", map(
                "rest_id", "https://t.co/fallback",
                "legacy", map(
                        "name", "summary_large_image",
                        "binding_values", map(
                                "card_url", map("string_value", "https://t.co/card", "type", "STRING"),
                                "title", map("string_value", "Card title", "type", "STRING"),
                                "description", map("string_value", "Card description", "type", "STRING"),
                                "summary_photo_image", map("image_value", map("url", "https://example.com/card.jpg"), "type", "IMAGE"),
                                "domain", map("string_value", "example.com", "type", "STRING")
                        )
                )
        ));
        return timelineTweetEntryFromResult(tweetId, map("__typename", "TweetWithVisibilityResults", "tweet", tweet));
    }

    private Map<String, Object> tweetResult(String tweetId, Map<String, Object> userResult) {
        return map(
                "__typename", "Tweet",
                "rest_id", tweetId,
                "core", map("user_results", map("result", userResult)),
                "views", map("count", "42"),
                "legacy", legacyTweet(tweetId)
        );
    }

    private Map<String, Object> timelineTweetEntryFromResult(String tweetId, Map<String, Object> result) {
        return map(
                "entryId", "tweet-" + tweetId,
                "content", map(
                        "entryType", "TimelineTimelineItem",
                        "itemContent", map(
                                "itemType", "TimelineTweet",
                                "__typename", "TimelineTweet",
                                "tweet_results", map("result", result)
                        )
                )
        );
    }

    private Map<String, Object> legacyTweet(String tweetId) {
        return map(
                "created_at", "Tue May 12 10:20:30 +0000 2026",
                "conversation_id_str", tweetId,
                "display_text_range", List.of(0, 11),
                "entities", map("user_mentions", List.of(), "urls", List.of(), "hashtags", List.of(), "symbols", List.of()),
                "favorite_count", 5,
                "full_text", "hello world",
                "lang", "en",
                "quote_count", 1,
                "reply_count", 2,
                "retweet_count", 3,
                "user_id_str", "123",
                "id_str", tweetId
        );
    }

    private Map<String, Object> coreOnlyUser() {
        return map(
                "__typename", "User",
                "rest_id", "123",
                "core", map("name", "Core User", "screen_name", "core_user"),
                "avatar", map("image_url", "https://example.com/avatar.jpg")
        );
    }

    private Map<String, Object> legacyUserWithoutScreenName() {
        return map(
                "__typename", "User",
                "rest_id", "123",
                "legacy", map("name", "No Screen")
        );
    }

    private Map<String, Object> unavailableTweetEntry() {
        return map(
                "entryId", "tweet-unavailable",
                "content", map(
                        "entryType", "TimelineTimelineItem",
                        "itemContent", map(
                                "itemType", "TimelineTweet",
                                "tweet_results", map("result", map("__typename", "TweetUnavailable"))
                        )
                )
        );
    }

    private Map<String, Object> cursorEntry() {
        return map(
                "entryId", "cursor-bottom",
                "content", map("entryType", "TimelineTimelineCursor", "value", "cursor")
        );
    }

    private Map<String, Object> map(Object... keyValues) {
        Map<String, Object> map = new LinkedHashMap<>();
        for (int i = 0; i < keyValues.length; i += 2) {
            map.put((String) keyValues[i], keyValues[i + 1]);
        }
        return map;
    }
}
