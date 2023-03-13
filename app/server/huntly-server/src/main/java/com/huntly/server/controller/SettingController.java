package com.huntly.server.controller;

import com.huntly.common.api.ApiResult;
import com.huntly.common.exceptions.BusinessException;
import com.huntly.common.exceptions.RequestVerifyException;
import com.huntly.common.util.XmlUtils;
import com.huntly.interfaces.external.dto.PreviewFeedsInfo;
import com.huntly.interfaces.external.model.FeedsSetting;
import com.huntly.interfaces.external.model.GitHubSetting;
import com.huntly.interfaces.external.model.LoginRequest;
import com.huntly.server.connector.rss.FeedUtils;
import com.huntly.server.domain.entity.Connector;
import com.huntly.server.domain.entity.Folder;
import com.huntly.server.domain.entity.GlobalSetting;
import com.huntly.server.domain.entity.TwitterUserSetting;
import com.huntly.server.service.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import javax.validation.Valid;
import javax.validation.constraints.NotNull;
import java.io.IOException;
import java.nio.charset.Charset;
import java.security.Principal;
import java.util.List;

/**
 * @author lcomplete
 */
@RestController
@RequestMapping("/api/setting")
public class SettingController {
    private final TwitterUserSettingService twitterUserSettingService;

    private final ConnectorService connectorService;

    private final OPMLService opmlService;

    private final FeedsService feedsService;

    private final FolderService folderService;

    private final UserService userService;
    
    private final GlobalSettingService globalSettingService;

    public SettingController(TwitterUserSettingService twitterUserSettingService, ConnectorService connectorService, OPMLService opmlService, FeedsService feedsService, FolderService folderService, UserService userService, GlobalSettingService globalSettingService) {
        this.twitterUserSettingService = twitterUserSettingService;
        this.connectorService = connectorService;
        this.opmlService = opmlService;
        this.feedsService = feedsService;
        this.folderService = folderService;
        this.userService = userService;
        this.globalSettingService = globalSettingService;
    }

    @PostMapping("github/save-token")
    public void saveGithubPersonalToken(@Valid @NotNull @RequestParam("token") String token) {
        connectorService.saveGithubPersonalToken(token);
    }

    @GetMapping("github/is-token-set")
    public ApiResult<Boolean> isGithubPersonalTokenSet() {
        return ApiResult.ok(connectorService.isGithubPersonalTokenSet());
    }

    @GetMapping("github/setting")
    public GitHubSetting getGitHubSetting() {
        return connectorService.getGitHubSetting();
    }

    @PostMapping("github/saveSetting")
    public Connector saveGitHubSetting(@RequestBody GitHubSetting gitHubSetting) {
        return connectorService.saveGitHubSetting(gitHubSetting);
    }

    @GetMapping("twitter/UserSettings")
    public List<TwitterUserSetting> getTwitterUserSettings() {
        return twitterUserSettingService.getTwitterUserSettings();
    }

    @PostMapping("twitter/saveUserSettings")
    public void saveTwitterUserSettings(@RequestBody List<TwitterUserSetting> settings) {
        twitterUserSettingService.save(settings);
    }

    @PostMapping("feeds/import-opml")
    public void importOpml(@RequestPart("file") MultipartFile file) {
        try {
            if (!file.isEmpty()) {
                var fileBytes = file.getInputStream().readAllBytes();
                Charset encoding = FeedUtils.guessEncoding(fileBytes);
                String opmlXMl = XmlUtils.removeInvalidXmlCharacters(new String(fileBytes, encoding));
                opmlService.importFolderAndConnector(opmlXMl);
            } else {
                throw new RequestVerifyException("file is empty");
            }
        } catch (IOException e) {
            throw new BusinessException(e);
        }
    }

    @GetMapping("feeds/preview")
    public PreviewFeedsInfo previewFeeds(@RequestParam String subscribeUrl) {
        return feedsService.previewFeeds(subscribeUrl);
    }

    @GetMapping("feeds/setting")
    public FeedsSetting getFeedsSetting(@RequestParam Integer connectorId) {
        return feedsService.getFeedsSetting(connectorId);
    }

    @PostMapping("feeds/follow")
    public Connector followFeed(@RequestParam String subscribeUrl) {
        return feedsService.followFeed(subscribeUrl);
    }

    @PostMapping("feeds/delete")
    public void deleteFeed(@RequestParam Integer connectorId) {
        feedsService.delete(connectorId);
    }

    @GetMapping("folder/all")
    public List<Folder> getSortedFolders() {
        List<Folder> sortedFolders = folderService.getSortedFolders();
        // add an empty folder for root
        sortedFolders.add(0, new Folder());
        return sortedFolders;
    }

    @GetMapping("folder/connectors")
    public List<Connector> getSortedConnectorsByFolderId(@RequestParam Integer folderId) {
        return connectorService.getSortedConnectorsByFolderId(folderId);
    }

    @PostMapping("folder/save")
    public Folder saveFolder(@RequestBody Folder folder) {
        return folderService.save(folder);
    }

    @PostMapping("folder/delete")
    public void deleteFolder(@RequestParam Integer folderId) {
        folderService.delete(folderId);
    }

    @PostMapping("folder/resort")
    public void resortFolders(@RequestBody List<Integer> folderIds) {
        folderService.resortFolders(folderIds);
    }

    @PostMapping("feeds/updateSetting")
    public Connector updateFeedsSetting(@RequestBody FeedsSetting feedsSetting) {
        return feedsService.updateFeedsSetting(feedsSetting);
    }

    @PostMapping("feeds/resort")
    public void resortConnectors(@RequestBody List<Integer> connectorIds) {
        connectorService.resortConnectors(connectorIds);
    }

    @PostMapping("user/updateLoginUser")
    public void updateLoginUser(@RequestBody LoginRequest loginRequest, Principal principal) {
        userService.updateLoginUser(loginRequest, principal.getName());
    }

    @GetMapping("general/globalSetting")
    public GlobalSetting getGlobalSetting() {
        return globalSettingService.getGlobalSetting();
    }
    
    @PostMapping("general/saveGlobalSetting")
    public GlobalSetting saveGlobalSetting(@RequestBody GlobalSetting globalSetting) {
        return globalSettingService.saveGlobalSetting(globalSetting);
    }
}
