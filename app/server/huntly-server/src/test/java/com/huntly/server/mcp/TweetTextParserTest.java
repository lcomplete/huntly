package com.huntly.server.mcp;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class TweetTextParserTest {

    @Test
    void extractPlainText_withTweetDataContainingMedia() {
        // Mock tweet data with media
        // fullText: "这是测试内容 https://t.co/xyz" (17 chars total)
        // "这是测试内容 " = 7 chars (index 0-6)
        // "https://t.co/xyz" = 16 chars (index 7-22)
        // Media indices [7, 23] to remove the t.co URL
        // displayTextRange [0, 7] to show only the text part (excluding media URL)
        String json = "{\"tweetIdStr\":\"1234567890123456789\",\"url\":\"https://twitter.com/testuser/status/1234567890123456789\"," +
                "\"userIdStr\":\"1234567890\",\"userName\":\"Test User\",\"userScreeName\":\"testuser\"," +
                "\"userProfileImageUrl\":\"https://example.com/profile.jpg\"," +
                "\"quoteCount\":5,\"replyCount\":10,\"retweetCount\":20,\"favoriteCount\":100,\"viewCount\":null," +
                "\"medias\":[{\"mediaUrl\":\"https://example.com/media.jpg\"," +
                "\"smallMediaUrl\":\"https://example.com/media_small.jpg\"," +
                "\"type\":\"photo\",\"rawSize\":{\"width\":800,\"height\":600}," +
                "\"smallSize\":{\"width\":400,\"height\":300},\"videoInfo\":null,\"indices\":[7,23]}]," +
                "\"createdAt\":\"2026-01-01T12:00:00Z\"," +
                "\"fullText\":\"这是测试内容 https://t.co/xyz\"," +
                "\"noteTweet\":null,\"displayTextRange\":[0,23],\"quotedTweet\":null,\"retweetedTweet\":null," +
                "\"card\":null,\"urls\":[],\"userMentions\":[],\"hashtags\":[]}";

        String result = TweetTextParser.extractPlainText(json);

        System.out.println("Extracted text: " + result);

        // Should extract the text without the t.co URL (media URL should be removed)
        assertThat(result).isNotNull();
        assertThat(result).isEqualTo("这是测试内容");
        // Media URL should be removed
        assertThat(result).doesNotContain("https://t.co/");
    }

    @Test
    void extractPlainText_withHashtags() {
        String json = "{\"fullText\":\"Testing #hashtag and more #tags\"," +
                "\"displayTextRange\":[0,31]," +
                "\"hashtags\":[{\"text\":\"hashtag\",\"indices\":[8,16]},{\"text\":\"tags\",\"indices\":[26,31]}]," +
                "\"urls\":[],\"userMentions\":[],\"medias\":[]}";

        String result = TweetTextParser.extractPlainText(json);

        System.out.println("Hashtag result: " + result);
        assertThat(result).isEqualTo("Testing #hashtag and more #tags");
    }

    @Test
    void extractPlainText_withUrls() {
        // Test URL replacement with display URL
        // Simple test: "Visit example.com today"
        // Where the original URL is replaced with display URL
        String json = "{\"fullText\":\"Visit https://t.co/xyz today\"," +
                "\"displayTextRange\":[0,28]," +
                "\"urls\":[{\"url\":\"https://t.co/xyz\",\"displayUrl\":\"example.com\",\"expandedUrl\":\"https://example.com\",\"indices\":[6,22]}]," +
                "\"hashtags\":[],\"userMentions\":[],\"medias\":[]}";

        String result = TweetTextParser.extractPlainText(json);

        System.out.println("URL result: " + result);
        assertThat(result).isEqualTo("Visit example.com today");
    }

    @Test
    void extractPlainText_withMentions() {
        String json = "{\"fullText\":\"Hey @user check this\"," +
                "\"displayTextRange\":[0,21]," +
                "\"userMentions\":[{\"screenName\":\"user\",\"indices\":[4,9]}]," +
                "\"hashtags\":[],\"urls\":[],\"medias\":[]}";

        String result = TweetTextParser.extractPlainText(json);

        System.out.println("Mention result: " + result);
        assertThat(result).isEqualTo("Hey @user check this");
    }

    @Test
    void extractPlainText_withRetweet() {
        String json = "{\"fullText\":\"RT @original: Original content\"," +
                "\"displayTextRange\":[0,31]," +
                "\"retweetedTweet\":{\"fullText\":\"Original content\"," +
                "\"displayTextRange\":[0,16],\"hashtags\":[],\"urls\":[],\"userMentions\":[],\"medias\":[]}," +
                "\"hashtags\":[],\"urls\":[],\"userMentions\":[],\"medias\":[]}";

        String result = TweetTextParser.extractPlainText(json);

        System.out.println("Retweet result: " + result);
        // Should extract from retweetedTweet
        assertThat(result).isEqualTo("Original content");
    }

    @Test
    void extractPlainText_withEmoji() {
        String json = "{\"fullText\":\"Hello 👋 World 🌍\"," +
                "\"displayTextRange\":[0,16]," +
                "\"hashtags\":[],\"urls\":[],\"userMentions\":[],\"medias\":[]}";

        String result = TweetTextParser.extractPlainText(json);

        System.out.println("Emoji result: " + result);
        assertThat(result).isEqualTo("Hello 👋 World 🌍");
    }

    @Test
    void extractPlainText_nullInput() {
        String result = TweetTextParser.extractPlainText(null);
        assertThat(result).isNull();
    }

    @Test
    void extractPlainText_emptyInput() {
        String result = TweetTextParser.extractPlainText("");
        assertThat(result).isNull();
    }

    @Test
    void extractPlainText_invalidJson() {
        String result = TweetTextParser.extractPlainText("not json");
        assertThat(result).isNull();
    }
}

