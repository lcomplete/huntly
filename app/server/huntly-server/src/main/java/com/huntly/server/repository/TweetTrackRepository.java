package com.huntly.server.repository;

import com.huntly.jpa.repository.JpaRepositoryWithLimit;
import com.huntly.server.domain.entity.TweetTrack;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;

/**
 * @author lcomplete
 */
@Repository
public interface TweetTrackRepository extends JpaRepository<TweetTrack,Long>, JpaSpecificationExecutor<TweetTrack>,JpaRepositoryWithLimit<TweetTrack, Long> {
    Optional<TweetTrack> findByTweetId(String tweetId);

    @Transactional
    @Modifying(clearAutomatically = true)
    @Query("DELETE FROM TweetTrack t WHERE t.readAt < :createdBefore")
    Integer deleteHistoryTrack(Instant createdBefore);
}
