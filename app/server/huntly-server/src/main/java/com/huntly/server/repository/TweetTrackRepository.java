package com.huntly.server.repository;

import com.huntly.jpa.repository.JpaRepositoryWithLimit;
import com.huntly.server.domain.entity.Page;
import com.huntly.server.domain.entity.TweetTrack;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * @author lcomplete
 */
@Repository
public interface TweetTrackRepository extends JpaRepository<TweetTrack,Long>, JpaSpecificationExecutor<TweetTrack>,JpaRepositoryWithLimit<TweetTrack, Long> {
    Optional<TweetTrack> findByTweetId(String tweetId);
}
