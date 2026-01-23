package com.huntly.server.service;

import com.huntly.common.util.TextUtils;
import com.huntly.common.util.UrlUtils;
import com.huntly.interfaces.external.model.CapturePage;
import com.huntly.interfaces.external.model.ContentType;
import com.huntly.interfaces.external.model.LibrarySaveStatus;
import com.huntly.interfaces.external.model.LibrarySaveType;
import com.huntly.server.domain.entity.Connector;
import com.huntly.server.domain.entity.Page;
import com.huntly.server.domain.entity.Source;
import com.huntly.server.repository.ConnectorRepository;
import com.huntly.server.repository.PageRepository;
import com.huntly.server.repository.SourceRepository;
import com.huntly.server.repository.TwitterUserSettingRepository;
import com.huntly.server.util.HtmlText;
import com.huntly.server.util.HtmlUtils;
import org.apache.commons.lang3.ObjectUtils;
import org.apache.commons.lang3.StringUtils;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * @author lcomplete
 */
@Service
public class CapturePageService extends BasePageService {
    private final SourceRepository sourceRepository;
    private final ConnectorRepository connectorRepository;
    private final TwitterUserSettingRepository twitterUserSettingRepository;

    // Lock map for preventing concurrent saves of the same tweet
    private final ConcurrentHashMap<String, Object> tweetSaveLocks = new ConcurrentHashMap<>();


    public CapturePageService(PageRepository pageRepository, LuceneService luceneService, SourceRepository sourceRepository, ConnectorRepository connectorRepository, TwitterUserSettingRepository twitterUserSettingRepository) {
        super(pageRepository, luceneService);
        this.sourceRepository = sourceRepository;
        this.connectorRepository = connectorRepository;
        this.twitterUserSettingRepository = twitterUserSettingRepository;
    }

    public Page save(CapturePage capturePage) {
        String contentText = cleanPageContent(capturePage);
        var source = saveSource(capturePage);
        boolean isSnippet = ObjectUtils.equals(capturePage.getContentType(), ContentType.SNIPPET.getCode());
        Optional<Page> existPage = isSnippet ? Optional.empty() : handleSamePage(capturePage);
        Page page;
        if (existPage.isEmpty()) {
            page = new Page();
            page.setLibrarySaveStatus(LibrarySaveStatus.NOT_SAVED.getCode());
            page.setStarred(false);
            page.setReadLater(false);
            page.setMarkRead(false);
            page.setCreatedAt(Instant.now());
            if (capturePage.getConnectorId() == null) {
                page.setFirstReadAt(Instant.now());
            }
            page.setReadCount(0);
        } else {
            page = existPage.get();
        }
        Optional<Connector> connector = capturePage.getConnectorId() != null ? connectorRepository.findById(capturePage.getConnectorId()) : Optional.empty();
        Connector rawConnector = null;
        if (page.getConnectorId() != null) {
            rawConnector = connectorRepository.findById(page.getConnectorId()).orElse(null);
        }
        // if page is new or raw connector is null or from same connector
        boolean shouldUpdateContent = page.getId() == null || rawConnector == null || Objects.equals(page.getConnectorId(), capturePage.getConnectorId());
        if (shouldUpdateContent) {
            page.setTitle(capturePage.getTitle());
            page.setContent(capturePage.getContent());
            page.setContentText(contentText);
            page.setUrl(capturePage.getUrl());
            page.setUrlWithoutHash(getUrlWithoutHash(capturePage.getUrl()));
            page.setDescription(capturePage.getDescription());
            page.setThumbUrl(capturePage.getThumbUrl());
            if (StringUtils.isBlank(page.getThumbUrl()) && capturePage.getNeedFindThumbUrl() != null) {
                String thumbUrl = HtmlUtils.findFirstPictureUrl(capturePage.getContent());
                page.setThumbUrl(thumbUrl);
            }
            page.setAuthor(capturePage.getAuthor());
            page.setLanguage(capturePage.getLanguage());
            page.setCategory(capturePage.getCategory());
            page.setPageJsonProperties(capturePage.getPageJsonProperties());
            if (connector.isPresent()) {
                page.setConnectorId(connector.get().getId());
                page.setFolderId(connector.get().getFolderId());
                page.setConnectorType(connector.get().getType());
            }
        }
        if (source != null) {
            page.setSourceId(source.getId());
        }
        if (capturePage.getConnectorId() == null) {
            page.setMarkRead(true);
            page.setLastReadAt(Instant.now());
            if (isSnippet) {
                page.setContentType(ContentType.SNIPPET.getCode());
            } else {
                page.setContentType(ContentType.BROWSER_HISTORY.getCode());
            }
            page.setReadCount(ObjectUtils.defaultIfNull(page.getReadCount(), 0) + 1);
        }
        if (capturePage.getConnectedAt() != null && page.getConnectedAt() == null) {
            page.setConnectedAt(capturePage.getConnectedAt());
        }

        return save(page);
    }

    public Page saveTweetPage(Page page, String loginScreenName, String browserScreenName, Integer minLikes, int favoriteCount) {
        // Use pageUniqueId (tweet id) as lock key for preventing concurrent saves of the same tweet
        String lockKey = StringUtils.isNotBlank(page.getPageUniqueId()) ? page.getPageUniqueId() : page.getUrl();
        Object lock = tweetSaveLocks.computeIfAbsent(lockKey, k -> new Object());

        try {
            synchronized (lock) {
                return doSaveTweetPage(page, loginScreenName, browserScreenName, minLikes, favoriteCount);
            }
        } finally {
            tweetSaveLocks.remove(lockKey);
        }
    }

    private Page doSaveTweetPage(Page page, String loginScreenName, String browserScreenName, Integer minLikes, int favoriteCount) {
        // Use pageUniqueId (tweet id) for duplicate detection, more reliable than URL
        Optional<Page> existPage = Optional.empty();
        if (StringUtils.isNotBlank(page.getPageUniqueId())) {
            existPage = pageRepository.findTop1ByPageUniqueId(page.getPageUniqueId());
        }
        // Fallback to URL if pageUniqueId not found
        if (existPage.isEmpty()) {
            existPage = pageRepository.findTop1ByUrl(page.getUrl());
        }
        if (existPage.isPresent()) {
            var currentPage = existPage.get();
            currentPage.setContent(page.getContent());
            currentPage.setAuthor(page.getAuthor());
            currentPage.setAuthorScreenName(page.getAuthorScreenName());
            currentPage.setContentType(page.getContentType());
            currentPage.setPageJsonProperties(page.getPageJsonProperties());
            currentPage.setCategory(page.getCategory());
            currentPage.setVoteScore(page.getVoteScore());
            // Update URL if it was previously null-based
            if (StringUtils.isNotBlank(page.getUrl()) && !page.getUrl().contains("/null/")) {
                currentPage.setUrl(page.getUrl());
            }
            // Update pageUniqueId if it was previously empty
            if (StringUtils.isNotBlank(page.getPageUniqueId()) && StringUtils.isBlank(currentPage.getPageUniqueId())) {
                currentPage.setPageUniqueId(page.getPageUniqueId());
            }
            page = currentPage;
        } else {
            page.setCreatedAt(Instant.now());
        }
        // tweet auto save rules
        String toUseScreenName = page.getAuthorScreenName();
        if (Objects.equals(page.getCategory(), "like") && StringUtils.isNotBlank(browserScreenName)) {
            toUseScreenName = browserScreenName;
        } else if (Objects.equals(page.getCategory(), "bookmark") && StringUtils.isNotBlank(loginScreenName)) {
            toUseScreenName = loginScreenName;
        }
        var twitterUserSetting = twitterUserSettingRepository.findByScreenName(toUseScreenName);

        // Check if this tweet matches a TwitterUserSetting rule with actual configuration
        boolean matchesSaveRule = false;
        Integer libraryType = null;
        Long collectionId = null;

        if (twitterUserSetting.isPresent()) {
            var setting = twitterUserSetting.get();

            // Priority: tweet (user's own) > bookmark > like
            // Only use if the setting has libraryType or collectionId configured
            boolean isOwnTweet = Objects.equals(page.getAuthorScreenName(), setting.getScreenName());
            boolean isBookmark = Objects.equals(page.getCategory(), "bookmark");
            boolean isLike = Objects.equals(page.getCategory(), "like");

            // 1. First priority: user's own tweet settings
            if (isOwnTweet && hasSetting(setting.getTweetToLibraryType(), setting.getTweetToCollectionId())) {
                libraryType = setting.getTweetToLibraryType();
                collectionId = setting.getTweetToCollectionId();
                matchesSaveRule = true;
            }
            // 2. Second priority: bookmark settings
            else if (isBookmark && hasSetting(setting.getBookmarkToLibraryType(), setting.getBookmarkToCollectionId())) {
                libraryType = setting.getBookmarkToLibraryType();
                collectionId = setting.getBookmarkToCollectionId();
                matchesSaveRule = true;
            }
            // 3. Third priority: like settings
            else if (isLike && hasSetting(setting.getLikeToLibraryType(), setting.getLikeToCollectionId())) {
                libraryType = setting.getLikeToLibraryType();
                collectionId = setting.getLikeToCollectionId();
                matchesSaveRule = true;
            }
        }

        // Apply minLikes filter only if the tweet does NOT match a TwitterUserSetting rule
        // Tweets that match rules should always be saved regardless of likes count
        if (!matchesSaveRule && minLikes != null && minLikes > 0) {
            if (favoriteCount < minLikes) {
                // Skip saving this tweet - it doesn't meet the minimum likes requirement
                return null;
            }
        }

        // If only collectionId is set (no libraryType), default to MY_LIST (code = 1)
        if (collectionId != null && (libraryType == null || libraryType == 0)) {
            libraryType = 1; // MY_LIST
        }

        // Apply library type settings
        LibrarySaveType librarySaveType = LibrarySaveType.fromCode(libraryType);
        if (librarySaveType != null) {
            switch (librarySaveType) {
                case STARRED:
                    page.setStarred(true);
                    page.setLibrarySaveStatus(LibrarySaveStatus.SAVED.getCode());
                    if (page.getSavedAt() == null) {
                        page.setSavedAt(Instant.now());
                    }
                    if (page.getStarredAt() == null) {
                        page.setStarredAt(Instant.now());
                    }
                    break;
                case READ_LATER:
                    page.setReadLater(true);
                    page.setLibrarySaveStatus(LibrarySaveStatus.SAVED.getCode());
                    if (page.getSavedAt() == null) {
                        page.setSavedAt(Instant.now());
                    }
                    if (page.getReadLaterAt() == null) {
                        page.setReadLaterAt(Instant.now());
                    }
                    break;
                case MY_LIST:
                    page.setLibrarySaveStatus(LibrarySaveStatus.SAVED.getCode());
                    if (page.getSavedAt() == null) {
                        page.setSavedAt(Instant.now());
                    }
                    break;
                case ARCHIVE:
                    page.setLibrarySaveStatus(LibrarySaveStatus.ARCHIVED.getCode());
                    if (page.getArchivedAt() == null) {
                        page.setArchivedAt(Instant.now());
                    }
                    break;
                default:
                    break;
            }
            if(page.getCollectedAt() == null) {
                page.setCollectedAt(Instant.now());
            }
        }

        if (collectionId != null) {
            page.setCollectionId(collectionId);
            // Ensure collectedAt is set when collectionId is set
            if (page.getCollectedAt() == null) {
                page.setCollectedAt(page.getCreatedAt() != null ? page.getCreatedAt() : Instant.now());
            }
        }

        return save(page);
    }

    /**
     * Check if a setting has either libraryType or collectionId configured
     */
    private boolean hasSetting(Integer libraryType, Long collectionId) {
        return (libraryType != null && libraryType > 0) || collectionId != null;
    }

    private Optional<Page> handleSamePage(CapturePage capturePage) {
        String url = capturePage.getUrl();
        url = guessMainUrl(url);
        capturePage.setUrl(url);

        int snippetContentType = ContentType.SNIPPET.getCode();
        Pageable limitOne = PageRequest.of(0, 1);
        
        List<Page> pages = pageRepository.findByUrlExcludingContentType(url, snippetContentType, limitOne);
        Optional<Page> page = pages.stream().findFirst();
        
        if (page.isPresent()) {
            return page;
        }

        // check other protocol url
        String otherProtocolUrl = UrlUtils.isHttpUrl(url) ? UrlUtils.getHttpsUrl(url) : UrlUtils.getHttpUrl(url);
        pages = pageRepository.findByUrlExcludingContentType(otherProtocolUrl, snippetContentType, limitOne);
        page = pages.stream().findFirst();
        
        if (page.isPresent()) {
            return page;
        }

        // if from browser
        // check url without hash
        if (capturePage.getConnectorId() == null) {
            String urlWithoutHash = getUrlWithoutHash(url);
            if (!Objects.equals(urlWithoutHash, url)) {
                List<Page> pagesWithoutHash = pageRepository.findByUrlWithoutHashExcludingContentType(urlWithoutHash, snippetContentType, limitOne);
                Optional<Page> pageWithoutHash = pagesWithoutHash.stream().findFirst();
                
                AtomicBoolean maybeSamePage = new AtomicBoolean(false);
                pageWithoutHash.ifPresent(p -> {
                    maybeSamePage.set(p.getTitle().equals(capturePage.getTitle())
                            || p.getContent().equals(capturePage.getContent())
                    );
                });
                if (maybeSamePage.get()) {
                    page = pageWithoutHash;
                    // use url without hash first when the page maybe same
                    capturePage.setUrl(urlWithoutHash);
                }
            }
        }

        return page;
    }

    private static String guessMainUrl(String url) {
        if (!url.contains("#")) {
            return url;
        }
        String[] urlParts = url.split("#");
        if (!urlParts[1].contains("/")) {
            return urlParts[0];
        }
        return url;
    }

    private static String getUrlWithoutHash(String url) {
        return url.contains("#") ? url.split("#")[0] : url;
    }

    /**
     * @param capturePage
     * @return clean content text
     */
    private String cleanPageContent(CapturePage capturePage) {
        String content = capturePage.getContent();
        String description = capturePage.getDescription();
        String baseUri = StringUtils.isNotBlank(capturePage.getBaseUrl()) ? capturePage.getBaseUrl() : capturePage.getUrl();

        boolean hasContent = StringUtils.isNotBlank(content);
        boolean hasDescription = StringUtils.isNotBlank(description);
        if (!hasContent && !hasDescription) {
            return "";
        }
        HtmlText htmlText = HtmlUtils.clean(hasContent ? content : description, baseUri);
        String cleanHtml = htmlText.getHtml();
        String cleanDescription = TextUtils.trimTruncate(hasDescription ? HtmlUtils.clean(description, baseUri).getText() : htmlText.getText(), 512);

        capturePage.setContent(cleanHtml);
        capturePage.setDescription(cleanDescription);

        return htmlText.getText();
    }

    private Source saveSource(CapturePage page) {
        if (StringUtils.isBlank(page.getDomain())) {
            return null;
        }
        var existSource = sourceRepository.findByDomain(page.getDomain());
        Source source;
        if (existSource.isEmpty()) {
            source = new Source();
            source.setDomain(page.getDomain());
        } else {
            source = existSource.get();
        }
        if (StringUtils.isNotBlank(page.getHomeUrl())) {
            source.setHomeUrl(page.getHomeUrl());
        }
        if (StringUtils.isNotBlank(page.getSiteName()) || StringUtils.isNotBlank(page.getDomain())) {
            source.setSiteName(StringUtils.firstNonBlank(page.getSiteName(), page.getDomain()));
        }
        if (StringUtils.isNotBlank(page.getFaviconUrl())) {
            source.setFaviconUrl(page.getFaviconUrl());
        }
        if (StringUtils.isNotBlank(page.getSubscribeUrl())) {
            source.setSubscribeUrl(page.getSubscribeUrl());
        }
        return sourceRepository.save(source);
    }

    public Page findByUrl(String url) {
        return pageRepository.findTop1ByUrl(url).orElse(null);
    }
}
