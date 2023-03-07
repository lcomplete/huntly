package com.huntly.server.service;

import com.huntly.interfaces.external.model.CapturePage;
import com.huntly.server.config.HuntlyProperties;
import com.huntly.server.connector.ConnectorType;
import com.huntly.server.connector.InfoConnector;
import com.huntly.server.connector.InfoConnectorFactory;
import com.huntly.server.domain.constant.AppConstants;
import com.huntly.server.domain.entity.Connector;
import com.huntly.server.event.EventPublisher;
import com.huntly.server.event.InboxChangedEvent;
import com.huntly.server.util.HttpUtils;
import com.huntly.server.util.SiteUtils;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.ObjectUtils;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

/**
 *
 */
@Service
@Slf4j
public class ConnectorFetchService {
    private final HuntlyProperties huntlyProperties;

    private final ConnectorService connectorService;

    private final CapturePageService capturePageService;

    private final EventPublisher eventPublisher;

    private final Set<Integer> inProcessConnectorIds;

    private final GlobalSettingService globalSettingService;

    ThreadPoolExecutor fetchExecutor;

    public ConnectorFetchService(HuntlyProperties huntlyProperties, ConnectorService connectorService, CapturePageService capturePageService, EventPublisher eventPublisher, GlobalSettingService globalSettingService) {
        this.huntlyProperties = huntlyProperties;
        this.connectorService = connectorService;
        this.capturePageService = capturePageService;
        this.eventPublisher = eventPublisher;
        this.globalSettingService = globalSettingService;
        inProcessConnectorIds = Collections.synchronizedSet(new HashSet<>());

        fetchExecutor = new ThreadPoolExecutor(
                ObjectUtils.defaultIfNull(huntlyProperties.getConnectorFetchCorePoolSize(), AppConstants.DEFAULT_CONNECTOR_FETCH_CORE_POOL_SIZE),
                ObjectUtils.defaultIfNull(huntlyProperties.getConnectorFetchMaxPoolSize(), AppConstants.DEFAULT_CONNECTOR_FETCH_MAX_POOL_SIZE),
                300, TimeUnit.SECONDS,
                new LinkedBlockingQueue<>(10000),
                r -> new Thread(r, "connector_fetch_thread")
        );
    }

    public void fetchAllConnectPages() {
        List<Connector> connectors = connectorService.getEnabledConnectors();
        for (var connector : connectors) {
            fetchPagesWithCheck(connector);
        }
    }

    private void fetchPagesWithCheck(Connector connector) {
        if (connector == null) {
            return;
        }
        if (log.isDebugEnabled()) {
            log.debug("fetch pages witch check, connector: " + connector.getName());
        }

        boolean isNeedFetch = isAtFetchTime(connector) && !inProcessConnectorIds.contains(connector.getId());
        if (isNeedFetch) {
            inProcessConnectorIds.add(connector.getId());
            fetchExecutor.execute(() -> tryFetchPages(connector));
        }
    }

    private void tryFetchPages(Connector connector) {
        var lastFetchBeginAt = connector.getLastFetchBeginAt();
        try {
            log.info("try fetch, connector: " + connector.getName());
            connectorService.updateLastFetchBeginAt(connector.getId(), Instant.now());
            fetchPages(connector);
            connectorService.updateLastFetchEndAt(connector.getId(), Instant.now(), true);
            log.info("fetch completed, connector: " + connector.getName());
        } catch (Exception ex) {
            // first fetch failed, must start again
            if (lastFetchBeginAt == null) {
                connectorService.updateLastFetchBeginAt(connector.getId(), null);
            }
            connectorService.updateLastFetchEndAt(connector.getId(), Instant.now(), false);
            log.error("connector fetch pages failed for connector: " + connector.getName(), ex);
        } finally {
            inProcessConnectorIds.remove(connector.getId());
        }
    }

    public void fetchPagesImmediately(Integer connectorId) {
        var connector = connectorService.findById(connectorId);
        tryFetchPages(connector);
    }

    private void fetchPages(Connector connector) {
        var connectorProperties = connectorService.getConnectorProperties(connector.getId());
        InfoConnector infoConnector = InfoConnectorFactory.createInfoConnector(connector.getType(), connectorProperties);
        if (infoConnector == null) {
            return;
        }
        var pages = connector.getLastFetchBeginAt() == null ? infoConnector.fetchAllPages() : infoConnector.fetchNewestPages();
        boolean inboxChangedTriggered = false;
        for (CapturePage page : pages) {
            page.setConnectorId(connector.getId());
            infoConnector.fetchPageContent(page);
            var savedPage = capturePageService.save(page);
            if (savedPage.getMarkRead() == null || Objects.equals(savedPage.getMarkRead(), false)) {
                inboxChangedTriggered = true;
                eventPublisher.publishInboxChangedEvent(new InboxChangedEvent(savedPage.getConnectorId()));
            }
        }

        // repair inbox count
        if (!inboxChangedTriggered) {
            eventPublisher.publishInboxChangedEvent(new InboxChangedEvent(connector.getId()));
        }

        if (Objects.equals(connector.getType(), ConnectorType.RSS.getCode())) {
            if (StringUtils.isBlank(connector.getIconUrl())) {
                var icon = SiteUtils.getFaviconFromHome(connector.getSubscribeUrl(), HttpUtils.buildHttpClient(globalSettingService.getProxySetting(), 10));
                if (icon != null) {
                    connectorService.updateIconUrl(connector.getId(), icon.getIconUrl());
                }
            }
        }
    }

    public static boolean isAtFetchTime(Connector connector) {
        if (connector == null) {
            return false;
        }
        Integer fetchIntervalSeconds = ObjectUtils.defaultIfNull(connector.getFetchIntervalSeconds(), AppConstants.DEFAULT_FETCH_INTERVAL_SECONDS);
        return connector.getLastFetchBeginAt() == null || connector.getLastFetchBeginAt().plusSeconds(fetchIntervalSeconds).isBefore(Instant.now());
    }
}
