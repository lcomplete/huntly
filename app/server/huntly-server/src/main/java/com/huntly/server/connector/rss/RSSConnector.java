package com.huntly.server.connector.rss;

import com.huntly.common.util.UrlUtils;
import com.huntly.interfaces.external.model.CapturePage;
import com.huntly.server.connector.ConnectorProperties;
import com.huntly.server.connector.InfoConnector;
import com.huntly.server.domain.exceptions.ConnectorFetchException;
import com.huntly.server.util.SiteUtils;
import com.rometools.rome.feed.synd.SyndCategory;
import com.rometools.rome.feed.synd.SyndContent;
import com.rometools.rome.feed.synd.SyndEntry;
import com.rometools.rome.feed.synd.SyndFeed;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.ObjectUtils;
import org.apache.commons.lang3.StringUtils;

import java.net.http.HttpClient;
import java.text.DateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.stream.Collectors;

/**
 * @author lcomplete
 */
@Slf4j
public class RSSConnector extends InfoConnector {
    private final ConnectorProperties connectorProperties;

    private final HttpClient client;

    public RSSConnector(ConnectorProperties connectorProperties) {
        this.connectorProperties = connectorProperties;
        this.client = buildHttpClient(connectorProperties);
    }

    public RSSConnector(ConnectorProperties connectorProperties, HttpClient httpClient) {
        this.connectorProperties = connectorProperties;
        this.client = httpClient;
    }

    @Override
    public List<CapturePage> fetchAllPages() {
        return fetchNewestPages();
    }

    @Override
    public List<CapturePage> fetchNewestPages() {
        if (StringUtils.isBlank(connectorProperties.getSubscribeUrl())) {
            return new ArrayList<>();
        }

        try {
            SyndFeed feed = FeedUtils.parseFeedUrl(connectorProperties.getSubscribeUrl(), client);
            var entries = feed.getEntries();
            List<CapturePage> pages = new ArrayList<>();
            for (var entry : entries) {
                CapturePage capturePage = new CapturePage();
                String content = getContent(entry);
                String description = StringUtils.trimToEmpty(entry.getDescription() == null ? null : entry.getDescription().getValue());
                capturePage.setUrl(entry.getLink());
                capturePage.setDomain(UrlUtils.getDomainName(entry.getLink()));
                capturePage.setContent(content);
                capturePage.setDescription(description);
                capturePage.setTitle(getTitle(entry));
                capturePage.setConnectedAt(ObjectUtils.firstNonNull(entry.getPublishedDate(), entry.getUpdatedDate(), feed.getPublishedDate(), new Date()).toInstant());
                capturePage.setAuthor(StringUtils.trimToEmpty(entry.getAuthor()));
                capturePage.setCategory(entry.getCategories().stream().map(SyndCategory::getName).collect(Collectors.joining(", ")));
                capturePage.setNeedFindThumbUrl(true);
                pages.add(capturePage);
            }

            return pages;
        } catch (Exception e) {
            throw new ConnectorFetchException(e);
        }
    }

    private String getTitle(SyndEntry item) {
        String title = item.getTitle();
        if (StringUtils.isBlank(title)) {
            Date date = item.getPublishedDate();
            if (date != null) {
                title = DateFormat.getInstance().format(date);
            } else {
                title = "(no title)";
            }
        }
        return StringUtils.trimToEmpty(title);
    }

    private String getContent(SyndEntry entry) {
        String content = null;
        if (!entry.getContents().isEmpty()) {
            content = entry.getContents().stream().map(SyndContent::getValue).collect(Collectors.joining(System.lineSeparator()));
        }
        return StringUtils.trimToEmpty(content);
    }

    @Override
    public CapturePage fetchPageContent(CapturePage capturePage) {
        if (Boolean.TRUE.equals(connectorProperties.getCrawlFullContent())) {
            try {
                String content = SiteUtils.parseArticleContent(capturePage.getUrl(), client);

                if (StringUtils.isNotBlank(content)) {
                    capturePage.setContent(content);
                }
            } catch (Exception e) {
                log.error("extract article failed for url: " + capturePage.getUrl(), e);
            }
        }
        return capturePage;
    }
}
