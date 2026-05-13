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

    public List<ParsedTweetPage> tweetsToPages(InterceptTweets tweets) {
        ObjectMapper mapper = new ObjectMapper();
        List<ParsedTweetPage> parsedPages = Lists.newArrayList();

        try {
            TweetsRoot root = mapper.readValue(tweets.getJsonData(), TweetsRoot.class);
            TweetsRoot.Timeline timeline = getTimeline(root);
            if (timeline == null || timeline.instructions == null) {
                return parsedPages;
            }

            timeline.instructions.forEach(ins -> {
                if (ins != null && ins.entries != null) {
                    ins.entries.forEach(entry -> {
                        if (entry == null) {
                            return;
                        }
                        getTweetItemContents(entry.content).forEach(content -> {
                            var itemParsedPages = itemContentToParsedPages(tweets.getCategory(), content);
                            parsedPages.addAll(itemParsedPages);
                        });
                    });
                }
            });
        } catch (JsonProcessingException e) {
            throw new RuntimeException(e);
        }

        // reverse pages to make sure the latest tweet is the first one
        Collections.reverse(parsedPages);
        return parsedPages;
    }

    private List<TweetsRoot.ItemContent> getTweetItemContents(TweetsRoot.Content content) {
        List<TweetsRoot.ItemContent> contents = Lists.newArrayList();
        if (content == null) {
            return contents;
        }

        addTweetItemContent(contents, content.itemContent);
        if (content.items != null) {
            content.items.forEach(item -> {
                if (item != null && item.item != null) {
                    addTweetItemContent(contents, item.item.itemContent);
                }
            });
        }
        return contents;
    }

    private void addTweetItemContent(List<TweetsRoot.ItemContent> contents, TweetsRoot.ItemContent itemContent) {
        if (itemContent != null && (Objects.equals(itemContent.itemType, "TimelineTweet")
                || Objects.equals(itemContent.__typename, "TimelineTweet")
                || itemContent.tweet_results != null)) {
            contents.add(itemContent);
        }
    }

    private List<ParsedTweetPage> itemContentToParsedPages(String category, TweetsRoot.ItemContent itemContent) {
        List<ParsedTweetPage> parsedPages = Lists.newArrayList();
        var tweetResult = getTweetResult(itemContent);
        if (!hasTweetLegacy(tweetResult)) {
            return parsedPages;
        }

        var views = tweetResult.views;
        var quotedTweet = getQuotedTweet(itemContent.tweet_results.result, tweetResult);

        ParsedTweetPage parsedPage = getParsedTweetPageFromDetail(category, tweetResult, views, quotedTweet, false);
        parsedPages.add(parsedPage);
        if (quotedTweet != null) {
            var quotedTweetResult = normalizeTweetResult(quotedTweet.result);
            ParsedTweetPage quotedParsedPage = getParsedTweetPageFromDetail(category, quotedTweetResult, quotedTweetResult.views, null, true);
            parsedPages.add(quotedParsedPage);
        }
        return parsedPages;
    }

    private TweetsRoot.Result getTweetResult(TweetsRoot.ItemContent itemContent) {
        if (itemContent == null || itemContent.tweet_results == null || itemContent.tweet_results.result == null) {
            return null;
        }
        return normalizeTweetResult(itemContent.tweet_results.result);
    }

    private TweetsRoot.Result normalizeTweetResult(TweetsRoot.Result tweetResult) {
        if (tweetResult == null) {
            return null;
        }
        return ObjectUtils.firstNonNull(tweetResult.tweet, tweetResult);
    }

    private boolean hasTweetLegacy(TweetsRoot.Result tweetResult) {
        return tweetResult != null && tweetResult.legacy != null;
    }

    private TweetsRoot.QuotedStatusResult getQuotedTweet(TweetsRoot.Result originalResult, TweetsRoot.Result tweetResult) {
        TweetsRoot.QuotedStatusResult quotedTweet = tweetResult.quoted_status_result;
        if (quotedTweet == null && originalResult != null) {
            quotedTweet = originalResult.quoted_status_result;
        }
        if (quotedTweet == null && tweetResult.legacy != null && tweetResult.legacy.retweeted_status_result != null
                && tweetResult.legacy.retweeted_status_result.result != null) {
            quotedTweet = tweetResult.legacy.retweeted_status_result.result.quoted_status_result;
        }
        if (quotedTweet == null || !hasTweetLegacy(normalizeTweetResult(quotedTweet.result))) {
            return null;
        }
        return quotedTweet;
    }

    private ParsedTweetPage getParsedTweetPageFromDetail(String category, TweetsRoot.Result tweetResult, TweetsRoot.Views views, TweetsRoot.QuotedStatusResult quotedTweet, boolean isFromQuote) {
        TweetProperties tweetProperties = getTweetProperties(tweetResult, views, quotedTweet);
        var tweet = tweetResult.legacy;

        TweetProperties realTweet = tweetProperties.getRetweetedTweet() != null ? tweetProperties.getRetweetedTweet() : tweetProperties;

        var page = new Page();
        page.setCategory(category);
        page.setContent(tweetProperties.getFullText());
        page.setUrl(tweetProperties.getUrl());
        page.setAuthor(realTweet.getUserName());
        page.setAuthorScreenName(realTweet.getUserScreeName());
        page.setContentType(isFromQuote ? ContentType.QUOTED_TWEET.getCode() : ContentType.TWEET.getCode());
        page.setLanguage(tweet.lang);
        page.setPageUniqueId(tweetProperties.getTweetIdStr());
        page.setConnectedAt(tweetProperties.getCreatedAt());
        page.setVoteScore(calcVoteScore(tweetProperties));

        page.setPageJsonProperties(JSONUtils.toJson(tweetProperties));

        return new ParsedTweetPage(page, tweetProperties);
    }

    private long calcVoteScore(TweetProperties tweetProperties) {
        int retweetCount = ObjectUtils.defaultIfNull(tweetProperties.getRetweetCount(), 0) + ObjectUtils.defaultIfNull(tweetProperties.getQuoteCount(), 0);
        int favoriteCount = ObjectUtils.defaultIfNull(tweetProperties.getFavoriteCount(), 0);
        long tweetMilli = tweetProperties.getCreatedAt() != null ? tweetProperties.getCreatedAt().toEpochMilli() : 0L;
        return (retweetCount * 8L + favoriteCount) * 10000000000L + tweetMilli / 1000L;
    }


    private TweetProperties getTweetProperties(TweetsRoot.Result tweetResult, TweetsRoot.Views views, TweetsRoot.QuotedStatusResult quotedTweet) {
        var tweet = tweetResult.legacy;
        var userResult = getUserResult(tweetResult);
        TweetProperties tweetProperties = new TweetProperties();
        String tweetId = StringUtils.defaultIfBlank(tweet.id_str, tweetResult.rest_id);
        tweetProperties.setUserIdStr(StringUtils.defaultIfBlank(tweet.user_id_str, userResult != null ? userResult.rest_id : null));
        tweetProperties.setUserName(getUserName(userResult));
        tweetProperties.setUserScreeName(getUserScreenName(userResult));
        tweetProperties.setUserProfileImageUrl(getUserProfileImageUrl(userResult));
        tweetProperties.setTweetIdStr(tweetId);
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
        tweetProperties.setUrl(buildTweetUrl(tweetProperties.getUserScreeName(), tweetId));
        // convert twitter datetime to instant
        String pattern = "EEE MMM dd HH:mm:ss ZZZZZ yyyy";
        SimpleDateFormat simpleDateFormat = new SimpleDateFormat(pattern, Locale.ENGLISH);
        if (StringUtils.isNotBlank(tweet.created_at)) {
            try {
                Date date = simpleDateFormat.parse(tweet.created_at);
                tweetProperties.setCreatedAt(date.toInstant());
            } catch (ParseException e) {
                throw new RuntimeException(e);
            }
        }
        // note tweet
        var noteTweet = tweetResult.note_tweet;
        if (noteTweet != null && noteTweet.note_tweet_results != null && noteTweet.note_tweet_results.result != null) {
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
                if (media == null) {
                    continue;
                }
                var tweetMedia = new TweetProperties.Media();
                tweetMedia.setMediaUrl(media.media_url_https);
                tweetMedia.setSmallMediaUrl(getTweetSmallMediaUrl(media.media_url_https));
                tweetMedia.setType(media.type);
                tweetMedia.setRawSize(getRawMediaSize(media.original_info));
                tweetMedia.setSmallSize(getSmallMediaSize(media.sizes));
                tweetMedia.setIndices(media.indices);

                if (tweet.extended_entities != null && tweet.extended_entities.media != null) {
                    for (TweetsRoot.Medium extendedMedia : tweet.extended_entities.media) {
                        if (extendedMedia != null && Objects.equals(extendedMedia.id_str, media.id_str)) {
                            tweetMedia.setType(extendedMedia.type);
                            // convert video_info to VideInfo
                            if (extendedMedia.video_info != null) {
                                var videoInfo = new TweetProperties.VideoInfo();
                                videoInfo.setAspectRatio(extendedMedia.video_info.aspect_ratio);
                                videoInfo.setDurationMillis(extendedMedia.video_info.duration_millis);
                                List<TweetProperties.Variant> variants = Lists.newArrayList();
                                if (!CollectionUtils.isEmpty(extendedMedia.video_info.variants)) {
                                    for (TweetsRoot.Variant variant : extendedMedia.video_info.variants) {
                                        if (variant == null) {
                                            continue;
                                        }
                                        var videoVariant = new TweetProperties.Variant();
                                        videoVariant.setBitrate(variant.bitrate);
                                        videoVariant.setContentType(variant.content_type);
                                        videoVariant.setUrl(variant.url);
                                        variants.add(videoVariant);
                                    }
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
            var card = getTweetCard(tweetResult.card);
            if (tweet.entities != null && !CollectionUtils.isEmpty(tweet.entities.urls)) {
                card.setUrl(tweet.entities.urls.get(0).expanded_url);
            }
            tweetProperties.setCard(card);
        }
        if (views != null) {
            tweetProperties.setViewCount(NumberUtils.toInt(views.count));
        }
        if (quotedTweet != null) {
            var quotedTweetResult = normalizeTweetResult(quotedTweet.result);
            if (hasTweetLegacy(quotedTweetResult)) {
                tweetProperties.setQuotedTweet(getTweetProperties(quotedTweetResult, quotedTweetResult.views, null));
            }
        }
        if (tweet.retweeted_status_result != null) {
            var retweetedTweetResult = normalizeTweetResult(tweet.retweeted_status_result.result);
            if (hasTweetLegacy(retweetedTweetResult)) {
                tweetProperties.setRetweetedTweet(getTweetProperties(retweetedTweetResult,
                        retweetedTweetResult.views, retweetedTweetResult.quoted_status_result));
            }
        }
        return tweetProperties;
    }

    private TweetProperties.Size getRawMediaSize(TweetsRoot.OriginalInfo originalInfo) {
        if (originalInfo == null) {
            return null;
        }
        return new TweetProperties.Size(originalInfo.width, originalInfo.height);
    }

    private TweetProperties.Size getSmallMediaSize(TweetsRoot.Sizes sizes) {
        if (sizes == null || sizes.small == null) {
            return null;
        }
        return new TweetProperties.Size(sizes.small.w, sizes.small.h);
    }

    private TweetProperties.Card getTweetCard(TweetsRoot.Card rawCard) {
        var card = new TweetProperties.Card();
        card.setUrl(rawCard.rest_id);
        if (rawCard.legacy == null) {
            return card;
        }

        card.setType(rawCard.legacy.name);
        setCardBindingValues(card, rawCard.legacy.binding_values);
        return card;
    }

    private void setCardBindingValues(TweetProperties.Card card, JsonNode bindingValues) {
        if (bindingValues == null || bindingValues.isNull()) {
            return;
        }
        if (bindingValues.isObject()) {
            bindingValues.fields().forEachRemaining(entry -> setCardBindingValue(card, entry.getKey(), entry.getValue()));
            return;
        }
        for (JsonNode bindingValue : bindingValues) {
            if (bindingValue == null || bindingValue.isNull()) {
                continue;
            }
            setCardBindingValue(card, getJsonText(bindingValue.get("key")), bindingValue.get("value"));
        }
    }

    private void setCardBindingValue(TweetProperties.Card card, String key, JsonNode value) {
        if (StringUtils.isBlank(key) || value == null || value.isNull()) {
            return;
        }
        if (Objects.equals(key, "card_url")) {
            card.setUrl(getStringValue(value));
        }
        if (Objects.equals(key, "title")) {
            card.setTitle(getStringValue(value));
        }
        if (Objects.equals(key, "description")) {
            card.setDescription(getStringValue(value));
        }
        if (Objects.equals(key, "summary_photo_image")) {
            card.setImageUrl(getImageUrl(value));
        }
        if (Objects.equals(key, "domain")) {
            card.setDomain(getStringValue(value));
        }
        if (Objects.equals(key, "thumbnail_image")) {
            card.setThumbnailImageUrl(getImageUrl(value));
        }
    }

    private String getStringValue(JsonNode value) {
        if (value == null || value.isNull()) {
            return null;
        }
        var stringValue = value.get("string_value");
        return stringValue != null ? getJsonText(stringValue) : getJsonText(value);
    }

    private String getImageUrl(JsonNode value) {
        if (value == null || value.isNull()) {
            return null;
        }
        var imageValue = value.get("image_value");
        if (imageValue == null || imageValue.isNull()) {
            return getJsonText(value.get("url"));
        }
        return getJsonText(imageValue.get("url"));
    }

    private String getJsonText(JsonNode node) {
        return node == null || node.isNull() ? null : node.asText();
    }

    private TweetsRoot.Result getUserResult(TweetsRoot.Result tweetResult) {
        if (tweetResult == null || tweetResult.core == null || tweetResult.core.user_results == null) {
            return null;
        }
        return tweetResult.core.user_results.result;
    }

    private String getUserName(TweetsRoot.Result userResult) {
        if (userResult == null) {
            return null;
        }
        String legacyName = userResult.legacy != null ? userResult.legacy.name : null;
        String coreName = userResult.core != null ? userResult.core.name : null;
        return StringUtils.defaultIfBlank(legacyName, coreName);
    }

    private String getUserScreenName(TweetsRoot.Result userResult) {
        if (userResult == null) {
            return null;
        }
        String legacyScreenName = userResult.legacy != null ? userResult.legacy.screen_name : null;
        String coreScreenName = userResult.core != null ? userResult.core.screen_name : null;
        return StringUtils.defaultIfBlank(legacyScreenName, coreScreenName);
    }

    private String getUserProfileImageUrl(TweetsRoot.Result userResult) {
        if (userResult == null) {
            return null;
        }
        String legacyProfileImageUrl = userResult.legacy != null ? userResult.legacy.profile_image_url_https : null;
        String avatarImageUrl = userResult.avatar != null ? userResult.avatar.image_url : null;
        return StringUtils.defaultIfBlank(legacyProfileImageUrl, avatarImageUrl);
    }

    private String buildTweetUrl(String screenName, String tweetId) {
        if (StringUtils.isBlank(tweetId)) {
            return null;
        }
        if (StringUtils.isBlank(screenName)) {
            return "https://x.com/i/web/status/" + tweetId;
        }
        return "https://x.com/" + screenName + "/status/" + tweetId;
    }

    private String getTweetSmallMediaUrl(String mediaUrlHttps) {
        if (StringUtils.isBlank(mediaUrlHttps)) {
            return mediaUrlHttps;
        }
        String smallMediaUrl = mediaUrlHttps;
        int formatIndex = mediaUrlHttps.lastIndexOf(".");
        if (formatIndex >= 0 && formatIndex < mediaUrlHttps.length() - 1) {
            String format = mediaUrlHttps.substring(formatIndex);
            smallMediaUrl = mediaUrlHttps.substring(0, formatIndex) + "?format=" + format.substring(1) + "&name=small";
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
                if (root.data.user.result.timeline != null && root.data.user.result.timeline.timeline != null) { // from user
                    timeline = root.data.user.result.timeline.timeline;
                } else {
                    timeline = root.data.user.result.timeline_v2.timeline;
                }
            } else if (root.data.threaded_conversation_with_injections_v2 != null) { // from tweet detail
                timeline = root.data.threaded_conversation_with_injections_v2;
            }
        }
        return timeline;
    }
}
