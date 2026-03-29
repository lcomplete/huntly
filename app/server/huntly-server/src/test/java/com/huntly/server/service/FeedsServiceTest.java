package com.huntly.server.service;

import com.huntly.interfaces.external.model.FeedsSetting;
import com.huntly.server.config.HuntlyProperties;
import com.huntly.server.connector.ConnectorType;
import com.huntly.server.domain.entity.Connector;
import com.huntly.server.repository.ConnectorRepository;
import com.huntly.server.repository.PageRepository;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class FeedsServiceTest {

    @Test
    void getFeedsSetting_returnsSystemDefaultWhenConnectorHasNoOverride() {
        HuntlyProperties huntlyProperties = new HuntlyProperties();
        ConnectorRepository connectorRepository = mock(ConnectorRepository.class);
        GlobalSettingService globalSettingService = mock(GlobalSettingService.class);

        Connector connector = new Connector();
        connector.setId(1);
        connector.setType(ConnectorType.RSS.getCode());
        connector.setName("Example Feed");
        connector.setSubscribeUrl("https://example.com/feed.xml");
        connector.setEnabled(true);
        connector.setCrawlFullContent(false);
        connector.setFetchIntervalSeconds(null);

        when(connectorRepository.findById(1)).thenReturn(Optional.of(connector));
        when(globalSettingService.getDefaultFeedFetchIntervalMinutes()).thenReturn(15);

        FeedsService feedsService = new FeedsService(
                huntlyProperties,
                mock(ConnectorService.class),
                mock(ConnectorFetchService.class),
                connectorRepository,
                globalSettingService,
                mock(PageRepository.class)
        );

        FeedsSetting feedsSetting = feedsService.getFeedsSetting(1);

        assertThat(feedsSetting.getDefaultFetchIntervalMinutes()).isEqualTo(15);
        assertThat(feedsSetting.getFetchIntervalMinutes()).isNull();
    }

    @Test
    void updateFeedsSetting_clearsConnectorOverrideWhenFetchIntervalIsBlank() {
        HuntlyProperties huntlyProperties = new HuntlyProperties();
        ConnectorRepository connectorRepository = mock(ConnectorRepository.class);
        GlobalSettingService globalSettingService = mock(GlobalSettingService.class);

        Connector connector = new Connector();
        connector.setId(1);
        connector.setType(ConnectorType.RSS.getCode());
        connector.setFolderId(null);
        connector.setFetchIntervalSeconds(600);

        when(connectorRepository.findById(1)).thenReturn(Optional.of(connector));
        when(connectorRepository.save(connector)).thenReturn(connector);

        FeedsService feedsService = new FeedsService(
                huntlyProperties,
                mock(ConnectorService.class),
                mock(ConnectorFetchService.class),
                connectorRepository,
                globalSettingService,
                mock(PageRepository.class)
        );

        FeedsSetting feedsSetting = new FeedsSetting();
        feedsSetting.setConnectorId(1);
        feedsSetting.setName("Example Feed");
        feedsSetting.setEnabled(true);
        feedsSetting.setCrawlFullContent(false);
        feedsSetting.setSubscribeUrl("https://example.com/feed.xml");
        feedsSetting.setFolderId(0);
        feedsSetting.setFetchIntervalMinutes(null);

        Connector updatedConnector = feedsService.updateFeedsSetting(feedsSetting);

        assertThat(updatedConnector.getFetchIntervalSeconds()).isNull();
    }
}
