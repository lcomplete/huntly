package com.huntly.server.connector.twitter;

import com.huntly.interfaces.external.model.InterceptTweets;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

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
}