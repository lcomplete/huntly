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
@Table(name = "tweet_track")
public class TweetTrack implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    @Column(name = "id")
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tweet_id")
    private String tweetId;

    @Column(name = "read_at")
    private Instant readAt;
    
    @Column(name = "is_set_read_at")
    private Boolean setReadAt;
}
