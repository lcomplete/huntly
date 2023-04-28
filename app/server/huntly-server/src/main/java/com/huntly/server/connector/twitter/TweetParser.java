package com.huntly.server.connector.twitter;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.common.collect.Lists;
import com.huntly.interfaces.external.model.ContentType;
import com.huntly.interfaces.external.model.InterceptTweets;
import com.huntly.interfaces.external.model.TweetProperties;
import com.huntly.server.domain.entity.Page;
import com.huntly.server.domain.model.tweet.TweetsRoot;
import com.huntly.server.util.JSONUtils;
import org.apache.commons.lang3.ObjectUtils;
import org.apache.commons.lang3.StringUtils;
import org.apache.commons.lang3.math.NumberUtils;
import org.springframework.stereotype.Component;
import org.springframework.util.CollectionUtils;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.regex.Pattern;

/**
 * @author lcomplete
 */
@Component
public class TweetParser {

    Pattern textMatchPattern = Pattern.compile("\\P{M}\\p{M}*+");

    public List<Page> tweetsToPages(InterceptTweets tweets) {
        ObjectMapper mapper = new ObjectMapper();
        List<Page> pages = Lists.newArrayList();
        try {
            TweetsRoot root = mapper.readValue(tweets.getJsonData(), TweetsRoot.class);
            TweetsRoot.Timeline timeline = getTimeline(root);
            if (timeline == null || timeline.instructions == null) {
                return pages;
            }

            timeline.instructions.forEach(ins -> {
                if (Objects.equals(ins.type, "TimelineAddEntries")) {
                    ins.entries.forEach(entry -> {
                        List<TweetsRoot.ItemContent> contents = Lists.newArrayList();
                        if (entry.content.items != null) {
                            entry.content.items.forEach(item -> {
                                if (item.item != null && item.item.itemContent != null && Objects.equals(item.item.itemContent.itemType, "TimelineTweet")) {
                                    contents.add(item.item.itemContent);
                                }
                            });
                        } else {
                            contents.add(entry.content.itemContent);
                        }
                        contents.forEach(content -> {
                            var itemPages = itemContentToPages(tweets.getCategory(), content);
                            pages.addAll(itemPages);
                        });
                    });
                }
            });
        } catch (JsonProcessingException e) {
            throw new RuntimeException(e);
        }

        // reverse pages to make sure the latest tweet is the first one
        Collections.reverse(pages);
        return pages;
    }

    private List<Page> itemContentToPages(String category, TweetsRoot.ItemContent itemContent) {
        List<Page> pages = Lists.newArrayList();
        if (itemContent == null || itemContent.tweet_results == null || itemContent.tweet_results.result == null) {
            return pages;
        }

        var tweet = ObjectUtils.firstNonNull(itemContent.tweet_results.result.tweet, itemContent.tweet_results.result);
        var user = tweet.core.user_results.result.legacy;
        if (user == null) {
            return pages;
        }

        var views = tweet.views;
        var quotedTweet = itemContent.tweet_results.result.quoted_status_result;
        if (quotedTweet == null && tweet.legacy != null && tweet.legacy.retweeted_status_result != null) {
            quotedTweet = tweet.legacy.retweeted_status_result.result.quoted_status_result;
        }
        // when tweet has been deleted by user, quotedTweet will be null
        if (quotedTweet == null || quotedTweet.result == null || quotedTweet.result.core == null) {
            quotedTweet = null;
        }

        Page page = getPageFromTweetDetail(category, tweet, user, views, quotedTweet, false);
        pages.add(page);
        if (quotedTweet != null) {
            Page quotedPage = getPageFromTweetDetail(category, quotedTweet.result, quotedTweet.result.core.user_results.result.legacy, null, null, true);
            pages.add(quotedPage);
        }
        return pages;
    }

    private Page getPageFromTweetDetail(String category, TweetsRoot.Result tweetResult, TweetsRoot.Legacy user, TweetsRoot.Views views, TweetsRoot.QuotedStatusResult quotedTweet, boolean isFromQuote) {
        TweetProperties tweetProperties = getTweetProperties(user, tweetResult, views, quotedTweet);
        var tweet = tweetResult.legacy;

        var page = new Page();
        page.setCategory(category);
        page.setContent(tweetProperties.getFullText());
        page.setUrl(tweetProperties.getUrl());
        page.setAuthor(user.name);
        page.setContentType(isFromQuote ? ContentType.QUOTED_TWEET.getCode() : ContentType.TWEET.getCode());
        page.setLanguage(tweet.lang);
        page.setPageUniqueId(tweetProperties.getTweetIdStr());
        page.setConnectedAt(tweetProperties.getCreatedAt());
        page.setVoteScore(calcVoteScore(tweetProperties));

        page.setPageJsonProperties(JSONUtils.toJson(tweetProperties));

        return page;
    }

    private long calcVoteScore(TweetProperties tweetProperties) {
        int retweetCount = ObjectUtils.defaultIfNull(tweetProperties.getRetweetCount(), 0) + ObjectUtils.defaultIfNull(tweetProperties.getQuoteCount(), 0);
        int favoriteCount = ObjectUtils.defaultIfNull(tweetProperties.getFavoriteCount(), 0);
        long tweetMilli = tweetProperties.getCreatedAt().toEpochMilli();
        return (retweetCount * 8L + favoriteCount) * 10000000000L + tweetMilli / 1000L;
    }


    private TweetProperties getTweetProperties(TweetsRoot.Legacy user, TweetsRoot.Result tweetResult, TweetsRoot.Views views, TweetsRoot.QuotedStatusResult quotedTweet) {
        var tweet = tweetResult.legacy;
        TweetProperties tweetProperties = new TweetProperties();
        tweetProperties.setUserIdStr(tweet.user_id_str);
        tweetProperties.setUserName(user.name);
        tweetProperties.setUserScreeName(user.screen_name);
        tweetProperties.setUserProfileImageUrl(user.profile_image_url_https);
        tweetProperties.setTweetIdStr(tweet.id_str);
        tweetProperties.setQuoteCount(tweet.quote_count);
        tweetProperties.setRetweetCount(tweet.retweet_count);
        tweetProperties.setReplyCount(tweet.reply_count);
        tweetProperties.setFavoriteCount(tweet.favorite_count);
        tweetProperties.setDisplayTextRange(tweet.display_text_range);
        // get tweet full text and handle emoji situation
        //List<String> textList = textMatchPattern.matcher(tweet.full_text)
        //        .results()
        //        .map(MatchResult::group)
        //        .skip(tweet.display_text_range.get(0))
        //        .limit(tweet.display_text_range.get(1))
        //        .collect(Collectors.toList());
        //tweetProperties.setFullText(String.join("", textList));
        // FE handle full text
        tweetProperties.setFullText(tweet.full_text);
        tweetProperties.setUrl("https://twitter.com/" + user.screen_name + "/status/" + tweet.id_str);
        // convert twitter datetime to instant
        String pattern = "EEE MMM dd HH:mm:ss ZZZZZ yyyy";
        SimpleDateFormat simpleDateFormat = new SimpleDateFormat(pattern, Locale.ENGLISH);
        try {
            Date date = simpleDateFormat.parse(tweet.created_at);
            tweetProperties.setCreatedAt(date.toInstant());
        } catch (ParseException e) {
            throw new RuntimeException(e);
        }
        // note tweet
        var noteTweet = tweetResult.note_tweet;
        if (noteTweet != null && noteTweet.note_tweet_results != null & noteTweet.note_tweet_results.result != null) {
            var noteResult = noteTweet.note_tweet_results.result;
            var entitySet = noteResult.entity_set;
            tweetProperties.setNoteTweet(true);
            tweetProperties.setFullText(noteResult.text);
            if (tweet.entities == null) {
                tweet.entities = new TweetsRoot.Entities();
            }
            if (entitySet != null && !CollectionUtils.isEmpty(entitySet.hashtags)) {
                tweet.entities.hashtags = entitySet.hashtags;
            }
            if (entitySet != null && !CollectionUtils.isEmpty(entitySet.urls)) {
                tweet.entities.urls = entitySet.urls;
            }
            if (entitySet != null && !CollectionUtils.isEmpty(entitySet.user_mentions)) {
                tweet.entities.user_mentions = entitySet.user_mentions;
            }
        }
        // media 
        if (tweet.entities != null && tweet.entities.media != null) {
            List<TweetProperties.Media> medias = Lists.newArrayList();
            for (TweetsRoot.Medium media : tweet.entities.media) {
                var tweetMedia = new TweetProperties.Media();
                tweetMedia.setMediaUrl(media.media_url_https);
                tweetMedia.setSmallMediaUrl(getTweetSmallMediaUrl(media.media_url_https));
                tweetMedia.setType(media.type);
                tweetMedia.setRawSize(new TweetProperties.Size(media.original_info.width, media.original_info.height));
                tweetMedia.setSmallSize(new TweetProperties.Size(media.sizes.small.w, media.sizes.small.h));
                tweetMedia.setIndices(media.indices);

                if (tweet.extended_entities != null && tweet.extended_entities.media != null) {
                    for (TweetsRoot.Medium extendedMedia : tweet.extended_entities.media) {
                        if (extendedMedia.id_str.equals(media.id_str)) {
                            tweetMedia.setType(extendedMedia.type);
                            // convert video_info to VideInfo
                            if (extendedMedia.video_info != null) {
                                var videoInfo = new TweetProperties.VideoInfo();
                                videoInfo.setAspectRatio(extendedMedia.video_info.aspect_ratio);
                                videoInfo.setDurationMillis(extendedMedia.video_info.duration_millis);
                                List<TweetProperties.Variant> variants = Lists.newArrayList();
                                for (TweetsRoot.Variant variant : extendedMedia.video_info.variants) {
                                    var videoVariant = new TweetProperties.Variant();
                                    videoVariant.setBitrate(variant.bitrate);
                                    videoVariant.setContentType(variant.content_type);
                                    videoVariant.setUrl(variant.url);
                                    variants.add(videoVariant);
                                }
                                videoInfo.setVariants(variants);
                                tweetMedia.setVideoInfo(videoInfo);
                                tweetMedia.setIndices(extendedMedia.indices);
                            }
                        }
                    }
                }

                medias.add(tweetMedia);
            }
            tweetProperties.setMedias(medias);
        }
        // hashtags
        if (tweet.entities != null && tweet.entities.hashtags != null) {
            List<TweetProperties.Hashtag> hashtags = Lists.newArrayList();
            for (TweetsRoot.Hashtag hashtag : tweet.entities.hashtags) {
                var tweetHashtag = new TweetProperties.Hashtag();
                tweetHashtag.setText(hashtag.text);
                tweetHashtag.setIndices(hashtag.indices);
                hashtags.add(tweetHashtag);
            }
            tweetProperties.setHashtags(hashtags);
        }
        // urls
        if (tweet.entities != null && tweet.entities.urls != null) {
            List<TweetProperties.UrlEntity> urls = Lists.newArrayList();
            for (TweetsRoot.Url url : tweet.entities.urls) {
                var tweetUrl = new TweetProperties.UrlEntity();
                tweetUrl.setUrl(url.url);
                tweetUrl.setDisplayUrl(url.display_url);
                tweetUrl.setExpandedUrl(url.expanded_url);
                tweetUrl.setIndices(url.indices);
                urls.add(tweetUrl);
            }
            tweetProperties.setUrls(urls);
        }
        // user_mentions
        if (tweet.entities != null && tweet.entities.user_mentions != null) {
            List<TweetProperties.UserMention> userMentions = Lists.newArrayList();
            for (TweetsRoot.UserMention userMention : tweet.entities.user_mentions) {
                var tweetUserMention = new TweetProperties.UserMention();
                tweetUserMention.setScreenName(userMention.screen_name);
                tweetUserMention.setName(userMention.name);
                tweetUserMention.setIdStr(userMention.id_str);
                tweetUserMention.setIndices(userMention.indices);
                userMentions.add(tweetUserMention);
            }
            tweetProperties.setUserMentions(userMentions);
        }
        // link card
        if (tweetResult.card != null) {
            var card = new TweetProperties.Card();
            card.setType(tweetResult.card.legacy.name);
            var bindingValues = tweetResult.card.legacy.binding_values;
            for (JsonNode bindingValue : bindingValues) {
                if (Objects.equals(bindingValue.get("key").asText(), "card_url")) {
                    card.setUrl(bindingValue.get("value").get("string_value").asText());
                }
                if (Objects.equals(bindingValue.get("key").asText(), "title")) {
                    card.setTitle(bindingValue.get("value").get("string_value").asText());
                }
                if (Objects.equals(bindingValue.get("key").asText(), "description")) {
                    card.setDescription(bindingValue.get("value").get("string_value").asText());
                }
                if (Objects.equals(bindingValue.get("key").asText(), "summary_photo_image")) {
                    card.setImageUrl(bindingValue.get("value").get("image_value").get("url").asText());
                }
                if (Objects.equals(bindingValue.get("key").asText(), "domain")) {
                    card.setDomain(bindingValue.get("value").get("string_value").asText());
                }
                if (Objects.equals(bindingValue.get("key").asText(), "thumbnail_image")) {
                    card.setThumbnailImageUrl(bindingValue.get("value").get("image_value").get("url").asText());
                }
            }
            if (tweet.entities != null && !CollectionUtils.isEmpty(tweet.entities.urls)) {
                card.setUrl(tweet.entities.urls.get(0).expanded_url);
            }
            tweetProperties.setCard(card);
        }
        if (views != null) {
            tweetProperties.setViewCount(NumberUtils.toInt(views.count));
        }
        if (quotedTweet != null && quotedTweet.result != null && quotedTweet.result.core != null && quotedTweet.result.core.user_results != null
                && quotedTweet.result.core.user_results.result != null && quotedTweet.result.core.user_results.result.legacy != null) {
            tweetProperties.setQuotedTweet(getTweetProperties(quotedTweet.result.core.user_results.result.legacy, quotedTweet.result, quotedTweet.result.views, null));
        }
        if (tweet.retweeted_status_result != null) {
            tweetProperties.setRetweetedTweet(getTweetProperties(tweet.retweeted_status_result.result.core.user_results.result.legacy,
                    tweet.retweeted_status_result.result, tweet.retweeted_status_result.result.views, tweet.retweeted_status_result.result.quoted_status_result));
        }
        return tweetProperties;
    }

    private String getTweetSmallMediaUrl(String mediaUrlHttps) {
        String smallMediaUrl = mediaUrlHttps;
        String format = mediaUrlHttps.substring(mediaUrlHttps.lastIndexOf("."));
        if (StringUtils.isNotEmpty(format)) {
            smallMediaUrl = mediaUrlHttps.substring(0, mediaUrlHttps.lastIndexOf(".")) + "?format=" + format.substring(1) + "&name=small";
        }
        return smallMediaUrl;
    }

    private static TweetsRoot.Timeline getTimeline(TweetsRoot root) {
        TweetsRoot.Timeline timeline = null;
        if (root.data != null) {
            if (root.data.home != null) {
                timeline = root.data.home.home_timeline_urt;
            } else if (root.data.list != null) {
                if (root.data.list.tweets_timeline != null && root.data.list.tweets_timeline.timeline != null) { // from list
                    timeline = root.data.list.tweets_timeline.timeline;
                } else {
                    timeline = root.data.list.tweets_timeline;
                }
            } else if (root.data.bookmark_timeline != null) {
                timeline = root.data.bookmark_timeline.timeline;
            } else if (root.data.bookmark_timeline_v2 != null) {
                timeline = root.data.bookmark_timeline_v2.timeline;
            } else if (root.data.viewer != null && root.data.viewer.communities_timeline != null) {
                timeline = root.data.viewer.communities_timeline.timeline;
            } else if (root.data.user != null) {
                timeline = root.data.user.result.timeline_v2.timeline;
            } else if (root.data.threaded_conversation_with_injections_v2 != null) { // from tweet detail
                timeline = root.data.threaded_conversation_with_injections_v2;
            }
        }
        return timeline;
    }
}
