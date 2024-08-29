package com.huntly.server.connector.rss;

import com.huntly.server.connector.ConnectorType;
import com.huntly.server.domain.entity.Connector;
import com.huntly.server.domain.entity.Folder;
import com.rometools.opml.feed.opml.Opml;
import com.rometools.opml.feed.opml.Outline;
import com.rometools.rome.io.FeedException;
import com.rometools.rome.io.WireFeedInput;
import org.apache.commons.lang3.StringUtils;
import org.springframework.util.CollectionUtils;

import java.io.StringReader;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * @author lcomplete
 */
public class OMPLConverter {
    private final String xml;

    private final List<Folder> folders;

    private final List<Connector> connectors;

    public List<Folder> getFolders() {
        return folders;
    }

    public List<Connector> getConnectors() {
        return connectors;
    }

    public OMPLConverter(String xml) {
        this.xml = xml;
        folders = new ArrayList<>();
        connectors = new ArrayList<>();
    }

    public void convert() {
        WireFeedInput input = new WireFeedInput();
        try {
            Opml opml = (Opml) input.build(new StringReader(xml));
            List<Outline> outlines = opml.getOutlines();
            for (int i = 0; i < outlines.size(); i++) {
                handleOutline(outlines.get(i), null, i);
            }
        } catch (FeedException e) {
            throw new RuntimeException(e);
        }
    }

    private void handleOutline(Outline outline, Folder parentFolder, int position) {
        List<Outline> children = outline.getChildren();
        if (CollectionUtils.isEmpty(children) && StringUtils.isNotBlank(outline.getXmlUrl())) {
            Connector connector = new Connector();
            connector.setEnabled(true);
            connector.setCreatedAt(Instant.now());
            connector.setType(ConnectorType.RSS.getCode());
            connector.setFolderId(parentFolder == null ? null : parentFolder.getId());
            connector.setDisplaySequence(parentFolder == null ? position : (parentFolder.getConnectors().size() + 1));
            connector.setName(outline.getText());
            connector.setSubscribeUrl(outline.getXmlUrl());
            // it's too slow at this time
            //var faviconUrl = SiteUtils.getFaviconFromHome(outline.getXmlUrl());
            //if (faviconUrl != null) {
            //    connector.setIconUrl(faviconUrl.getIconUrl());
            //}
            if (parentFolder != null) {
                parentFolder.getConnectors().add(connector);
            } else {
                connectors.add(connector);
            }
        } else {
            // only support one level folder
            if (parentFolder == null) {
                Folder folder = new Folder();
                folder.setName(outline.getText());
                folder.setDisplaySequence(position);
                folder.setCreatedAt(Instant.now());
                folders.add(folder);
                parentFolder = folder;
            }
            for (int i = 0; i < children.size(); i++) {
                handleOutline(children.get(i), parentFolder, i);
            }
        }
    }
}
