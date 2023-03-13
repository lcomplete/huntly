package com.huntly.server.service;

import com.huntly.common.exceptions.NoSuchDataException;
import com.huntly.interfaces.external.dto.PreviewFeedsInfo;
import com.huntly.interfaces.external.model.FeedsSetting;
import com.huntly.server.connector.ConnectorType;
import com.huntly.server.connector.rss.FeedUtils;
import com.huntly.server.domain.constant.AppConstants;
import com.huntly.server.domain.entity.Connector;
import com.huntly.server.repository.ConnectorRepository;
import com.huntly.server.util.HttpUtils;
import com.huntly.server.util.SiteUtils;
import com.rometools.rome.feed.synd.SyndFeed;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;

import java.time.Instant;

/**
 * @author lcomplete
 */
@Service
public class FeedsService {
    private final ConnectorService connectorService;

    private final ConnectorFetchService connectorFetchService;

    private final ConnectorRepository connectorRepository;

    private final GlobalSettingService globalSettingService;

    public FeedsService(ConnectorService connectorService, ConnectorFetchService connectorFetchService, ConnectorRepository connectorRepository, GlobalSettingService globalSettingService) {
        this.connectorService = connectorService;
        this.connectorFetchService = connectorFetchService;
        this.connectorRepository = connectorRepository;
        this.globalSettingService = globalSettingService;
    }

    public Connector followFeed(String subscribeUrl) {
        PreviewFeedsInfo feedsInfo = previewFeeds(subscribeUrl);
        Connector connector = connectorService.getBySubscribeUrl(subscribeUrl, ConnectorType.RSS);
        boolean isNew = false;
        if (connector != null) {
            connector.setName(feedsInfo.getTitle());
            connector.setIconUrl(feedsInfo.getSiteFaviconUrl());
        } else {
            connector = new Connector();
            connector.setSubscribeUrl(subscribeUrl);
            connector.setType(ConnectorType.RSS.getCode());
            connector.setCrawlFullContent(false);
            connector.setEnabled(true);
            connector.setDisplaySequence(1);
            connector.setName(feedsInfo.getTitle());
            connector.setInboxCount(0);
            connector.setIconUrl(feedsInfo.getSiteFaviconUrl());
            connector.setCreatedAt(Instant.now());
            isNew = true;
        }
        connector = connectorRepository.save(connector);
        if (isNew) {
            connectorFetchService.fetchPagesImmediately(connector.getId());
        }
        return connector;
    }

    public PreviewFeedsInfo previewFeeds(String subscribeUrl) {
        PreviewFeedsInfo feedsInfo = new PreviewFeedsInfo();
        feedsInfo.setFeedUrl(subscribeUrl);
        var httpClient = HttpUtils.buildHttpClient(globalSettingService.getProxySetting());
        SyndFeed syndFeed = FeedUtils.parseFeedUrl(subscribeUrl, httpClient);
        if (syndFeed != null) {
            feedsInfo.setSiteLink(syndFeed.getLink());
            feedsInfo.setTitle(syndFeed.getTitle());
            feedsInfo.setDescription(syndFeed.getDescription());
        }
        Connector connector = connectorService.getBySubscribeUrl(subscribeUrl, ConnectorType.RSS);
        if (connector != null) {
            feedsInfo.setSubscribed(true);
            feedsInfo.setTitle(connector.getName());
        }
        if (StringUtils.isBlank(feedsInfo.getSiteFaviconUrl())) {
            SiteUtils.Favicon favicon = SiteUtils.getFaviconFromHome(feedsInfo.getSiteLink(), httpClient);
            if (favicon != null) {
                feedsInfo.setSiteFaviconUrl(favicon.getIconUrl());
            }
        }
        return feedsInfo;
    }

    private Connector requireOneFeedConnector(Integer connectorId) {
        Connector connector = connectorRepository.findById(connectorId).orElse(null);
        if (connector == null || !ConnectorType.RSS.getCode().equals(connector.getType())) {
            throw new NoSuchDataException("connector not found by id: " + connectorId);
        }
        return connector;
    }

    public Connector updateFeedsSetting(FeedsSetting feedsSetting) {
        Connector connector = requireOneFeedConnector(feedsSetting.getConnectorId());
        connector.setCrawlFullContent(feedsSetting.getCrawlFullContent());
        connector.setName(feedsSetting.getName());
        connector.setEnabled(feedsSetting.getEnabled());
        connector.setSubscribeUrl(feedsSetting.getSubscribeUrl());
        connector.setFolderId(feedsSetting.getFolderId() == null || feedsSetting.getFolderId().equals(0) ? null : feedsSetting.getFolderId());
        connector.setFetchIntervalSeconds(feedsSetting.getFetchIntervalMinutes() * 60);
        return connectorRepository.save(connector);
    }

    public void delete(Integer connectorId) {
        Connector connector = requireOneFeedConnector(connectorId);
        connectorRepository.delete(connector);
    }

    public FeedsSetting getFeedsSetting(Integer connectorId) {
        Connector connector = requireOneFeedConnector(connectorId);
        FeedsSetting feedsSetting = new FeedsSetting();
        feedsSetting.setConnectorId(connector.getId());
        feedsSetting.setCrawlFullContent(connector.getCrawlFullContent());
        feedsSetting.setName(connector.getName());
        feedsSetting.setEnabled(connector.getEnabled());
        feedsSetting.setFolderId(connector.getFolderId());
        feedsSetting.setSubscribeUrl(connector.getSubscribeUrl());
        int fetchIntervalMinutes = AppConstants.DEFAULT_FETCH_INTERVAL_SECONDS / 60;
        if (connector.getFetchIntervalSeconds() != null) {
            fetchIntervalMinutes = connector.getFetchIntervalSeconds() / 60;
        }
        feedsSetting.setFetchIntervalMinutes(fetchIntervalMinutes);
        return feedsSetting;
    }
}
