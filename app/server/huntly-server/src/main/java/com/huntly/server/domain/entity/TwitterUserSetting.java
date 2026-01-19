package com.huntly.server.domain.entity;

import lombok.Data;

import javax.persistence.*;
import java.io.Serializable;
import java.time.Instant;

/**
 * @author lcomplete
 */
@Data
@Entity
@Table(name = "twitter_user_setting")
public class TwitterUserSetting implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @Column(name = "id")
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;
    
    @Column(name = "name")
    private String name;
    
    @Column(name = "screen_name")
    private String screenName;
    
    @Column(name = "bookmark_to_library_type")
    private Integer bookmarkToLibraryType;
    
    @Column(name = "like_to_library_type")
    private Integer likeToLibraryType;
    
    @Column(name = "retweet_to_library_type")
    private Integer tweetToLibraryType;
    
    @Column(name = "is_myself")
    private Boolean myself;

    @Column(name = "tweet_to_collection_id")
    private Long tweetToCollectionId;

    @Column(name = "bookmark_to_collection_id")
    private Long bookmarkToCollectionId;

    @Column(name = "like_to_collection_id")
    private Long likeToCollectionId;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;
}
