package com.huntly.server.service;

import com.google.common.collect.Lists;
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
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * @author lcomplete
 */
@Service
public class CapturePageService extends BasePageService {
    private final SourceRepository sourceRepository;
    private final ConnectorRepository connectorRepository;

    private final TwitterUserSettingRepository twitterUserSettingRepository;


    public CapturePageService(PageRepository pageRepository, LuceneService luceneService, SourceRepository sourceRepository, ConnectorRepository connectorRepository, TwitterUserSettingRepository twitterUserSettingRepository) {
        super(pageRepository, luceneService);
        this.sourceRepository = sourceRepository;
        this.connectorRepository = connectorRepository;
        this.twitterUserSettingRepository = twitterUserSettingRepository;
    }

    public Page save(CapturePage capturePage) {
        String contentText = cleanPageContent(capturePage);
        var source = saveSource(capturePage);
        var existPage = handleSamePage(capturePage);
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
            page.setContentType(ContentType.BROWSER_HISTORY.getCode());
            page.setReadCount(ObjectUtils.defaultIfNull(page.getReadCount(), 0) + 1);
        }
        if (capturePage.getConnectedAt() != null && page.getConnectedAt() == null) {
            page.setConnectedAt(capturePage.getConnectedAt());
        }

        return save(page);
    }

    public Page saveTweetPage(Page page, String loginScreenName, String browserScreenName) {
        var existPage = pageRepository.findTop1ByUrl(page.getUrl());
        if (existPage.isPresent()) {
            var currentPage = existPage.get();
            currentPage.setContent(page.getContent());
            currentPage.setAuthor(page.getAuthor());
            currentPage.setContentType(page.getContentType());
            currentPage.setPageJsonProperties(page.getPageJsonProperties());
            currentPage.setCategory(page.getCategory());
            page = currentPage;
        } else {
            page.setCreatedAt(Instant.now());
        }
        // tweet auto save
        String toUseScreenName = page.getAuthor();
        if (Objects.equals(page.getCategory(), "like") && StringUtils.isNotBlank(browserScreenName)) {
            toUseScreenName = browserScreenName;
        } else if (Objects.equals(page.getCategory(), "bookmark") && StringUtils.isNotBlank(loginScreenName)) {
            toUseScreenName = loginScreenName;
        }
        var twitterUserSetting = twitterUserSettingRepository.findByScreenName(toUseScreenName);
        if (twitterUserSetting.isPresent()) {
            var setting = twitterUserSetting.get();
            List<Integer> saveTypes = Lists.newArrayList();
            if (Objects.equals(page.getCategory(), "bookmark")) {
                saveTypes.add(setting.getBookmarkToLibraryType());
            } else if (Objects.equals(page.getCategory(), "like")) {
                saveTypes.add(setting.getLikeToLibraryType());
            }
            if (Objects.equals(page.getAuthor(), setting.getScreenName())) {
                saveTypes.add(setting.getTweetToLibraryType());
            }
            for (Integer saveType : saveTypes) {
                LibrarySaveType librarySaveType = LibrarySaveType.fromCode(saveType);
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
                }
            }
        }
        return save(page);
    }

    private Optional<Page> handleSamePage(CapturePage capturePage) {
        String url = capturePage.getUrl();
        url = guessMainUrl(url);
        capturePage.setUrl(url);
        var page = pageRepository.findTop1ByUrl(url);
        if (page.isPresent()) {
            return page;
        }

        // check other protocol url
        String otherProtocolUrl = UrlUtils.isHttpUrl(url) ? UrlUtils.getHttpsUrl(url) : UrlUtils.getHttpUrl(url);
        page = pageRepository.findTop1ByUrl(otherProtocolUrl);
        if (page.isPresent()) {
            return page;
        }

        // if from browser
        // check url without hash
        if (capturePage.getConnectorId() == null) {
            String urlWithoutHash = getUrlWithoutHash(url);
            if (!Objects.equals(urlWithoutHash, url)) {
                var pageWithoutHash = pageRepository.findTop1ByUrlWithoutHash(urlWithoutHash);
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
