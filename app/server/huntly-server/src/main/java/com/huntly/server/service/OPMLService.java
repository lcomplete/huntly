package com.huntly.server.service;

import com.huntly.jpa.spec.Sorts;
import com.huntly.server.connector.ConnectorType;
import com.huntly.server.connector.rss.OMPLConverter;
import com.huntly.server.domain.entity.Connector;
import com.huntly.server.domain.entity.Folder;
import com.huntly.server.repository.ConnectorRepository;
import com.huntly.server.repository.FolderRepository;
import com.rometools.opml.feed.opml.Opml;
import com.rometools.opml.feed.opml.Outline;
import com.rometools.rome.io.FeedException;
import com.rometools.rome.io.WireFeedOutput;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;

import java.io.IOException;
import java.net.URL;
import java.util.Date;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * @author lcomplete
 */
@Service
public class OPMLService {
    private FolderService folderService;

    private ConnectorService connectorService;
    private final FolderRepository folderRepository;
    private final ConnectorRepository connectorRepository;

    public OPMLService(FolderService folderService, ConnectorService connectorService,
                       FolderRepository folderRepository,
                       ConnectorRepository connectorRepository) {
        this.folderService = folderService;
        this.connectorService = connectorService;
        this.folderRepository = folderRepository;
        this.connectorRepository = connectorRepository;
    }

    public void importFolderAndConnector(String opmlXml) {
        OMPLConverter converter = new OMPLConverter(opmlXml);
        converter.convert();
        for (Folder folder : converter.getFolders()) {
            Folder savedFolder = folderService.saveWhenNotExist(folder);
            if (!CollectionUtils.isEmpty(folder.getConnectors())) {
                for (var connector : folder.getConnectors()) {
                    connector.setFolderId(savedFolder.getId());
                    connectorService.saveWhenNotExist(connector);
                }
            }
        }
        for (Connector connector : converter.getConnectors()) {
            connectorService.saveWhenNotExist(connector);
        }
    }

    public String exportOpml() throws IOException, FeedException {
        Opml opml = new Opml();
        List<Connector> connectors = connectorRepository
                .findAll(Sorts.builder().asc("displaySequence").build())
                .stream()
                .filter(c -> Objects.equals(c.getType(), ConnectorType.RSS.getCode()))
                .collect(Collectors.toList());

        var noFolderConnectors = connectors.stream().filter(t -> t.getFolderId() == null || t.getFolderId() == 0)
                .collect(Collectors.toList());
        for (var connector : noFolderConnectors) {
            Outline outline = new Outline(connector.getName(), new URL(connector.getSubscribeUrl()), null);
            outline.setText(connector.getName());
            opml.getOutlines().add(outline);
        }

        List<Folder> folders = folderRepository.findAll(Sorts.builder().asc("displaySequence").build());
        for (var folder : folders) {
            var connectorsInFolder = connectors.stream().filter(t -> Objects.equals(t.getFolderId(), folder.getId()))
                    .collect(Collectors.toList());
            Outline folderOutline = new Outline();
            folderOutline.setText(folder.getName());
            for (var connector : connectorsInFolder) {
                Outline outline = new Outline(connector.getName(), new URL(connector.getSubscribeUrl()), null);
                outline.setText(connector.getName());
                folderOutline.getChildren().add(outline);
            }
            opml.getOutlines().add(folderOutline);
        }

        opml.setTitle("Exported by huntly");
        opml.setFeedType("opml_2.0");
        opml.setCreated(new Date());

        return new WireFeedOutput().outputString(opml);
    }
}
