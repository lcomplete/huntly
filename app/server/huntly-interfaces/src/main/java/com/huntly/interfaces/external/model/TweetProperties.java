package com.huntly.interfaces.external.model;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.List;

/**
 * @author lcomplete
 */
@Getter
@Setter
public class TweetProperties {
    private String tweetIdStr;
    
    private String url;
    
    private String userIdStr;
    
    private String userName;
    
    private String userScreeName;
    
    private String userProfileImageUrl;
    
    private Integer quoteCount;
    
    private Integer replyCount;
    
    private Integer retweetCount;
    
    private Integer favoriteCount;
    
    private Integer viewCount;
    
    private List<Media> medias;
    
    private Instant createdAt;
    
    private String fullText;
    
    private Boolean noteTweet;
    
    private List<Integer> displayTextRange; 
    
    private TweetProperties quotedTweet;
    
    private TweetProperties retweetedTweet;
    
    private Card card;
    
    private List<UrlEntity> urls;
    
    private List<UserMention> userMentions;
    
    private List<Hashtag> hashtags;
    
    @Getter
    @Setter
    public static class Hashtag{
        private String text;
        
        private List<Integer> indices;
    }
    
    @Getter
    @Setter
    public static class Card {
        
        // type = summary | summary_large_image
        private String type;
        
        private String title;
        
        private String description;
        
        private String imageUrl;
        
        private String thumbnailImageUrl;
        
        private String url;
        
        private String domain;
    }
    
    @Getter
    @Setter
    public static class Media {
        private String mediaUrl;
        
        private String smallMediaUrl;
        
        private String type;
        
        private Size rawSize;
        
        private Size smallSize;
        
        private VideoInfo videoInfo;
        
        private List<Integer> indices;
    }
    
    @Getter
    @Setter
    public static class VideoInfo{
        private List<Variant> variants;
        
        private List<Integer> aspectRatio;
        
        private Integer durationMillis;
    }
    
    @Getter
    @Setter
    public static class Variant{
        private String url;
        
        private Integer bitrate;
        
        private String contentType;
    }
    
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Size{
        private Integer width;

        private Integer height;
    }
    
    @Getter
    @Setter
    public static class UrlEntity{
        private String url;
        
        private String displayUrl;
        
        private String expandedUrl;
        
        private List<Integer> indices;
    }
    
    @Getter
    @Setter
    public static class UserMention{
        private String screenName;
        
        private String name;
        
        private String idStr;
        
        private List<Integer> indices;
    }
    
    
}
