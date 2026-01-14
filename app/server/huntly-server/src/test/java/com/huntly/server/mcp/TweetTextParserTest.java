package com.huntly.server.mcp;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class TweetTextParserTest {

    @Test
    void extractPlainText_withRealTweetData() {
        // Real tweet data from database
        String json = "{\"tweetIdStr\":\"2011041502173249904\",\"url\":\"https://twitter.com/null/status/2011041502173249904\"," +
                "\"userIdStr\":\"3016619443\",\"userName\":\"Jason\",\"userScreeName\":\"EvanWritesX\"," +
                "\"userProfileImageUrl\":\"https://pbs.twimg.com/profile_images/1993562015932334082/50xwYK4V_normal.jpg\"," +
                "\"quoteCount\":5,\"replyCount\":48,\"retweetCount\":65,\"favoriteCount\":475,\"viewCount\":null," +
                "\"medias\":[{\"mediaUrl\":\"https://pbs.twimg.com/media/G-inlZzaUAAsf_a.jpg\"," +
                "\"smallMediaUrl\":\"https://pbs.twimg.com/media/G-inlZzaUAAsf_a?format=jpg&name=small\"," +
                "\"type\":\"photo\",\"rawSize\":{\"width\":942,\"height\":2048}," +
                "\"smallSize\":{\"width\":313,\"height\":680},\"videoInfo\":null,\"indices\":[96,119]}]," +
                "\"createdAt\":\"2026-01-13T11:43:52Z\"," +
                "\"fullText\":\"N26注册成功了\\n先简单分享一下\\n\\n不需要德国IP\\n我全程挂着美区IP\\n申请成功\\n\\n护照用照片也能通过\\n\\n虽然网上有很多教程\\n但是可能流程更新\\n有些吃不准的地方\\n全程借助Gemini完成注册 https://t.co/KjcdMb3mC9\"," +
                "\"noteTweet\":null,\"displayTextRange\":[0,95],\"quotedTweet\":null,\"retweetedTweet\":null," +
                "\"card\":null,\"urls\":[],\"userMentions\":[],\"hashtags\":[]}";

        String result = TweetTextParser.extractPlainText(json);

        System.out.println("Extracted text: " + result);

        // Should extract the full text without the t.co URL (media URL should be removed)
        assertThat(result).isNotNull();
        assertThat(result).contains("N26注册成功了");
        assertThat(result).contains("全程借助Gemini完成注册");
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
        // "Check this https://t.co/abc123 out" - indices for t.co URL: [11, 34] (23 chars)
        String json = "{\"fullText\":\"Check this https://t.co/abc123 out\"," +
                "\"displayTextRange\":[0,38]," +
                "\"urls\":[{\"url\":\"https://t.co/abc123\",\"displayUrl\":\"example.com\",\"expandedUrl\":\"https://example.com\",\"indices\":[11,34]}]," +
                "\"hashtags\":[],\"userMentions\":[],\"medias\":[]}";

        String result = TweetTextParser.extractPlainText(json);

        System.out.println("URL result: " + result);
        assertThat(result).isEqualTo("Check this example.com out");
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

