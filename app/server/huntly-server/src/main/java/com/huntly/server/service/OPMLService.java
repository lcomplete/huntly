package com.huntly.server.service;

import com.huntly.server.connector.rss.OMPLConverter;
import com.huntly.server.domain.entity.Connector;
import com.huntly.server.domain.entity.Folder;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;

/**
 * @author lcomplete
 */
@Service
public class OPMLService {
    private FolderService folderService;

    private ConnectorService connectorService;

    public OPMLService(FolderService folderService, ConnectorService connectorService) {
        this.folderService = folderService;
        this.connectorService = connectorService;
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
}
