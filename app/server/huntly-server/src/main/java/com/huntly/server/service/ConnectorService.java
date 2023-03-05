package com.huntly.server.service;

import com.huntly.interfaces.external.dto.ConnectorItem;
import com.huntly.interfaces.external.dto.FolderConnectorView;
import com.huntly.interfaces.external.dto.FolderConnectors;
import com.huntly.server.connector.ConnectorProperties;
import com.huntly.server.connector.ConnectorType;
import com.huntly.server.domain.entity.Connector;
import com.huntly.server.domain.entity.ConnectorSetting;
import com.huntly.server.domain.entity.Folder;
import com.huntly.server.domain.mapper.ConnectorItemMapper;
import com.huntly.server.repository.ConnectorRepository;
import com.huntly.server.repository.ConnectorSettingRepository;
import com.huntly.server.repository.FolderRepository;
import com.huntly.server.repository.PageRepository;
import org.apache.commons.lang3.StringUtils;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class ConnectorService {

    private final FolderRepository folderRepository;

    private final ConnectorRepository connectorRepository;

    private final ConnectorSettingRepository connectorSettingRepository;

    private final PageRepository pageRepository;

    private GlobalSettingService globalSettingService;

    public ConnectorService(FolderRepository folderRepository, ConnectorSettingRepository connectorSettingRepository, ConnectorRepository connectorRepository, PageRepository pageRepository, GlobalSettingService globalSettingService) {
        this.folderRepository = folderRepository;
        this.connectorSettingRepository = connectorSettingRepository;
        this.connectorRepository = connectorRepository;
        this.pageRepository = pageRepository;
        this.globalSettingService = globalSettingService;
    }

    public Connector findById(Integer id) {
        return connectorRepository.findById(id).orElse(null);
    }

    public List<Connector> getEnabledConnectors() {
        return connectorRepository.findByEnabledTrue();
    }

    public ConnectorProperties getConnectorProperties(Integer connectorId) {
        var connector = connectorRepository.findById(connectorId);
        ConnectorProperties properties = new ConnectorProperties();
        connector.ifPresent(con -> {
            properties.setCrawlFullContent(con.getCrawlFullContent());
            properties.setApiToken(con.getApiToken());
            properties.setSubscribeUrl(con.getSubscribeUrl());
            properties.setLastFetchAt(con.getLastFetchBeginAt());
            properties.setProxySetting(globalSettingService.getProxySetting());
        });
        return properties;
    }

    private String getSettingValue(List<ConnectorSetting> settings, String key) {
        var setting = settings.stream().filter(t -> Objects.equals(t.getSettingKey(), key)).findFirst();
        return setting.isPresent() ? setting.get().getSettingValue() : "";
    }

    public void updateLastFetchBeginAt(Integer connectorId, Instant beginAt) {
        var connector = connectorRepository.findById(connectorId).orElse(null);
        if (connector != null) {
            connector.setLastFetchBeginAt(beginAt);
            connectorRepository.save(connector);
        }
    }

    public void updateLastFetchEndAt(Integer connectorId, Instant endAt, boolean success) {
        var connector = connectorRepository.findById(connectorId).orElse(null);
        if (connector != null) {
            connector.setLastFetchEndAt(endAt);
            connector.setLastFetchSuccess(success);
            connectorRepository.save(connector);
        }
    }

    public Connector saveWhenNotExist(Connector connector) {
        var existsConnector = connectorRepository.findBySubscribeUrlAndType(connector.getSubscribeUrl(), connector.getType());
        if (existsConnector.isEmpty()) {
            connectorRepository.save(connector);
        }
        return connector;
    }

    public FolderConnectorView getFolderConnectorView(boolean onlyEnabled) {
        List<Folder> folders = folderRepository.findAll();
        folders.sort(Comparator.comparing(Folder::getDisplaySequence));
        List<Connector> connectors = null;
        if (onlyEnabled) {
            connectors = connectorRepository.findByEnabledTrue();
        } else {
            connectors = connectorRepository.findAll();
        }
        FolderConnectorView view = new FolderConnectorView();
        view.setFolderConnectors(getFolderConnectors(folders, connectors, false));
        view.setFolderFeedConnectors(getFolderConnectors(folders, connectors, true));
        return view;
    }

    private List<FolderConnectors> getFolderConnectors(List<Folder> folders, List<Connector> connectors, boolean isRss) {
        if (isRss) {
            connectors = connectors.stream().filter(t -> ConnectorType.RSS.getCode().equals(t.getType())).collect(Collectors.toList());
        } else {
            connectors = connectors.stream().filter(t -> !ConnectorType.RSS.getCode().equals(t.getType())).collect(Collectors.toList());
        }
        List<FolderConnectors> folderConnectorsList = new ArrayList<>();

        // add connectors without folder first
        var noFolderConnectors = connectors.stream().filter(t -> t.getFolderId() == null || t.getFolderId() == 0)
                .collect(Collectors.toList());
        // fill by an empty folder
        fillFolderConnectors(folderConnectorsList, new Folder(), noFolderConnectors);

        // add folder connectors
        for (var folder : folders) {
            var childConnectors = connectors.stream().filter(t -> Objects.equals(t.getFolderId(), folder.getId()))
                    .collect(Collectors.toList());
            fillFolderConnectors(folderConnectorsList, folder, childConnectors);
        }
        return folderConnectorsList;
    }

    private void fillFolderConnectors(List<FolderConnectors> folderConnectorsList, Folder folder, List<Connector> childConnectors) {
        if (!CollectionUtils.isEmpty(childConnectors)) {
            FolderConnectors folderConnectors = new FolderConnectors();
            folderConnectors.setId(folder.getId());
            folderConnectors.setName(folder.getName());
            folderConnectors.setConnectorItems(toConnectorItems(childConnectors));
            folderConnectorsList.add(folderConnectors);
        }
    }

    private List<ConnectorItem> toConnectorItems(List<Connector> connectors) {
        return connectors.stream().sorted(Comparator.comparing(Connector::getDisplaySequence))
                .map(ConnectorItemMapper.INSTANCE::fromConnector).collect(Collectors.toList());
    }

    public void updateInboxCount(Integer connectorId) {
        var connector = findById(connectorId);
        if (connector != null) {
            var inboxCount = getUnreadCount(connectorId);
            connector.setInboxCount(inboxCount);
            connectorRepository.save(connector);
        }
    }

    public void updateInboxCount(Integer connectorId, Integer inboxCount) {
        var connector = findById(connectorId);
        if (connector != null) {
            connector.setInboxCount(inboxCount);
            connectorRepository.save(connector);
        }
    }

    private int getUnreadCount(Integer connectorId) {
        return pageRepository.countByConnectorIdAndMarkRead(connectorId, false);
    }

    public void saveGithubPersonalToken(String token) {
        var connectors = connectorRepository.findByType(ConnectorType.GITHUB.getCode());
        var connector = connectors.isEmpty() ? null : connectors.get(0);
        if (connector == null) {
            connector = new Connector();
            connector.setType(ConnectorType.GITHUB.getCode());
            connector.setCrawlFullContent(false);
            connector.setEnabled(true);
            connector.setDisplaySequence(1);
            connector.setName("GitHub");
            connector.setInboxCount(0);
            connector.setApiToken(token);
            connector.setCreatedAt(Instant.now());
            connectorRepository.save(connector);
        } else {
            connector.setApiToken(token);
            connectorRepository.save(connector);
        }
    }

    public boolean isGithubPersonalTokenSet() {
        var connectors = connectorRepository.findByType(ConnectorType.GITHUB.getCode());
        var connector = connectors.isEmpty() ? null : connectors.get(0);
        return connector != null && StringUtils.isNotBlank(connector.getApiToken());
    }

    public Connector getBySubscribeUrl(String subscribeUrl, ConnectorType connectorType) {
        return connectorRepository.findBySubscribeUrlAndType(subscribeUrl, connectorType.getCode()).orElse(null);
    }

    public void updateIconUrl(Integer id, String iconUrl) {
        var connector = findById(id);
        if (connector != null) {
            connector.setIconUrl(iconUrl);
            connectorRepository.save(connector);
        }
    }

    public List<Connector> getSortedConnectorsByFolderId(Integer folderId) {
        return connectorRepository.findByFolderIdAndType(folderId == null || folderId == 0 ? null : folderId,
                ConnectorType.RSS.getCode(),
                Sort.sort(Connector.class).by(Connector::getDisplaySequence).ascending());
    }

    public void resortConnectors(List<Integer> connectorIds) {
        for (int i = 0; i < connectorIds.size(); i++) {
            var connector = findById(connectorIds.get(i));
            if (connector != null) {
                connector.setDisplaySequence(i + 1);
                connectorRepository.save(connector);
            }
        }
    }
}
