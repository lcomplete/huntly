package com.huntly.server.controller;

import com.huntly.common.api.ApiResult;
import com.huntly.interfaces.external.dto.FolderConnectorView;
import com.huntly.server.domain.entity.Connector;
import com.huntly.server.service.ConnectorService;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import javax.validation.constraints.NotNull;

/**
 * @author lcomplete
 */
@RestController
@RequestMapping("/api/connector")
public class ConnectorController {

    private final ConnectorService connectorService;

    public ConnectorController(ConnectorService connectorService) {
        this.connectorService = connectorService;
    }

    @GetMapping("folder-connectors")
    public FolderConnectorView getFolderConnectorView() {
        return connectorService.getFolderConnectorView(true);
    }

    @GetMapping("/{id}")
    public Connector getConnectorById(@Valid @NotNull @PathVariable("id") Integer id) {
        return connectorService.findById(id);
    }

    @GetMapping("github/inboxCount")
    public ApiResult<Long> getGitHubInboxCount() {
        return ApiResult.ok(connectorService.getGitHubInboxCount());
    }

    @GetMapping("feeds/unreadCount")
    public ApiResult<Long> getUnreadFeedCount() {
        return ApiResult.ok(connectorService.getUnreadFeedCount());
    }

}
