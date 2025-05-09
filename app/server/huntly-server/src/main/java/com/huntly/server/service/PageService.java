package com.huntly.server.service;

import com.huntly.common.exceptions.NoSuchDataException;
import com.huntly.interfaces.external.dto.ConnectorItem;
import com.huntly.interfaces.external.dto.PageOperateResult;
import com.huntly.interfaces.external.model.LibrarySaveStatus;
import com.huntly.interfaces.external.query.PageQuery;
import com.huntly.server.domain.entity.Page;
import com.huntly.server.domain.enums.ArticleContentCategory;
import com.huntly.server.domain.mapper.ConnectorItemMapper;
import com.huntly.server.domain.vo.PageDetail;

import com.huntly.server.event.EventPublisher;
import com.huntly.server.event.InboxChangedEvent;
import com.huntly.server.repository.ConnectorRepository;
import com.huntly.server.repository.PageRepository;
import com.huntly.server.repository.SourceRepository;
import com.huntly.server.util.HtmlText;
import com.huntly.server.util.HtmlUtils;
import com.huntly.server.util.HttpUtils;
import com.huntly.server.util.SiteUtils;
import org.apache.commons.lang3.ObjectUtils;
import org.apache.commons.lang3.StringUtils;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Objects;

/**
 * @author lcomplete
 */
@Service
public class PageService extends BasePageService {

    private final ConnectorRepository connectorRepository;

    private final SourceRepository sourceRepository;

    private final GlobalSettingService globalSettingService;

    private final PageArticleContentService pageArticleContentService;

    private final EventPublisher eventPublisher;

    private final OpenAIService openAIService;

    public PageService(PageRepository pageRepository, LuceneService luceneService, ConnectorRepository connectorRepository, SourceRepository sourceRepository, GlobalSettingService globalSettingService, PageArticleContentService pageArticleContentService, EventPublisher eventPublisher, OpenAIService openAIService) {
        super(pageRepository, luceneService);
        this.connectorRepository = connectorRepository;
        this.sourceRepository = sourceRepository;
        this.globalSettingService = globalSettingService;
        this.pageArticleContentService = pageArticleContentService;
        this.eventPublisher = eventPublisher;
        this.openAIService = openAIService;
    }

    public void delete(Long id) {
        var page = requireOne(id);
        deleteById(id);
        pageArticleContentService.deleteByPageId(id);
        sendInboxChangedEvent(page.getConnectorId());
    }

    private Page requireOne(Long id) {
        var page = pageRepository.findById(id);
        if (page.isEmpty()) {
            throw new NoSuchDataException("Page Data not found: " + id);
        }
        return page.get();
    }

    public PageOperateResult saveToLibrary(Long id) {
        return updateLibrarySaveStatus(id, LibrarySaveStatus.SAVED);
    }

    public PageOperateResult removeFromLibrary(Long id) {
        return updateLibrarySaveStatus(id, LibrarySaveStatus.NOT_SAVED);
    }

    public PageOperateResult archiveToLibrary(Long id) {
        return updateLibrarySaveStatus(id, LibrarySaveStatus.ARCHIVED);
    }

    public PageOperateResult updateLibrarySaveStatus(Long id, LibrarySaveStatus librarySaveStatus) {
        var page = requireOne(id);
        if (!Objects.equals(page.getLibrarySaveStatus(), librarySaveStatus.getCode())) {
            setPageLibrarySaveStatus(page, librarySaveStatus);
            save(page);
        }
        return toPageOperateResult(page);
    }

    private PageOperateResult toPageOperateResult(Page page) {
        var result = new PageOperateResult();
        if (page == null) {
            return result;
        }
        result.setId(page.getId());
        result.setStarred(page.getStarred());
        result.setReadLater(page.getReadLater());
        result.setLibrarySaveStatus(page.getLibrarySaveStatus());
        return result;
    }

    public void setPageLibrarySaveStatus(Page page, LibrarySaveStatus librarySaveStatus) {
        page.setLibrarySaveStatus(librarySaveStatus.getCode());
        if (librarySaveStatus.getCode() == LibrarySaveStatus.SAVED.getCode()) {
            page.setSavedAt(Instant.now());
        } else if (librarySaveStatus.getCode() == LibrarySaveStatus.ARCHIVED.getCode()) {
            page.setArchivedAt(Instant.now());
        } else if (librarySaveStatus.getCode() == LibrarySaveStatus.NOT_SAVED.getCode()) {
            // if not save, clear status
            page.setStarred(false);
            page.setReadLater(false);
        }
    }

    public PageOperateResult starPage(Long id) {
        var page = requireOne(id);
        setPageStarred(page);
        save(page);
        return toPageOperateResult(page);
    }

    public void setPageStarred(Page page) {
        page.setStarred(true);
        page.setStarredAt(Instant.now());
        ensureSaveFirst(page);
    }

    private void ensureSaveFirst(Page page) {
        if (page.getLibrarySaveStatus() == null || Objects.equals(page.getLibrarySaveStatus(), LibrarySaveStatus.NOT_SAVED.getCode())) {
            setPageLibrarySaveStatus(page, LibrarySaveStatus.SAVED);
        }
    }

    public PageOperateResult unStarPage(Long id) {
        var page = requireOne(id);
        page.setStarred(false);
        save(page);
        return toPageOperateResult(page);
    }

    public PageOperateResult readLaterPage(Long id) {
        var page = requireOne(id);
        setPageReadLater(page);
        save(page);
        return toPageOperateResult(page);
    }

    public void setPageReadLater(Page page) {
        page.setReadLater(true);
        page.setReadLaterAt(Instant.now());
        ensureSaveFirst(page);
    }

    public PageOperateResult unReadLaterPage(Long id) {
        var page = requireOne(id);
        page.setReadLater(false);
        save(page);
        return toPageOperateResult(page);
    }

    public void markReadPage(Long id) {
        var page = requireOne(id);
        if (!Objects.equals(page.getMarkRead(), true)) {
            page.setMarkRead(true);
            save(page);
            sendInboxChangedEvent(page.getConnectorId());
        }
    }

    private void sendInboxChangedEvent(Integer connectorId) {
        sendInboxChangedEvent(connectorId, null);
    }

    private void sendInboxChangedEvent(Integer connectorId, Integer inboxCount) {
        eventPublisher.publishInboxChangedEvent(new InboxChangedEvent(connectorId).setInboxCount(inboxCount));
    }

    public void unMarkReadPage(Long id) {
        var page = requireOne(id);
        if (!Objects.equals(page.getMarkRead(), false)) {
            page.setMarkRead(false);
            save(page);
            sendInboxChangedEvent(page.getConnectorId());
        }
    }

    public void recordReadPage(Long id) {
        var page = requireOne(id);
        page.setReadCount(page.getReadCount() + 1);
        page.setLastReadAt(Instant.now());
        if (!Objects.equals(page.getMarkRead(), true)) {
            page.setMarkRead(true);
            save(page);
            sendInboxChangedEvent(page.getConnectorId());
        } else {
            save(page);
        }
    }

    public PageDetail getPageDetail(Long id) {
        Page page = requireOne(id);
        PageDetail pageDetail = new PageDetail();
        pageDetail.setPage(page);
        if (page.getConnectorId() != null) {
            var connector = connectorRepository.findById(page.getConnectorId()).orElse(null);
            ConnectorItem connectorItem = connector != null ? ConnectorItemMapper.INSTANCE.fromConnector(connector) : null;
            pageDetail.setConnector(connectorItem);
        }
        if (page.getSourceId() != null) {
            pageDetail.setSource(sourceRepository.findById(page.getSourceId()).orElse(null));
        }
        pageDetail.setPageContents(pageArticleContentService.findContents(page.getId()));
        return pageDetail;
    }

    public Integer markReadByPageIds(List<Long> ids, boolean markRead) {
        int effectCount = pageRepository.updateMarkReadByIds(ids, markRead);
        List<Integer> connectorIds = pageRepository.getConnectorIdsByPageIds(ids);
        connectorIds.forEach(this::sendInboxChangedEvent);
        return effectCount;
    }

    public Integer markReadByConnectorId(Integer connectorId, boolean markRead) {
        int effectCount = pageRepository.updateMarkReadByConnectorId(connectorId, markRead);
        if (effectCount > 0) {
            sendInboxChangedEvent(connectorId, markRead ? 0 : null);
        }
        return effectCount;
    }

    public Integer markReadByFolderId(Integer folderId, boolean markRead) {
        int effectCount = pageRepository.updateMarkReadByFolderId(folderId, markRead);
        if (effectCount > 0) {
            var connectors = connectorRepository.findByFolderId(folderId);
            connectors.forEach(c -> sendInboxChangedEvent(c.getId(), markRead ? 0 : null));
        }
        return effectCount;
    }

    public Integer markReadByConnectorType(Integer connectorType, boolean markRead) {
        int effectCount = pageRepository.updateMarkReadByConnectorType(connectorType, markRead);
        if (effectCount > 0) {
            var connectors = connectorRepository.findByType(connectorType);
            connectors.forEach(c -> sendInboxChangedEvent(c.getId(), markRead ? 0 : null));
        }
        return effectCount;
    }

    public Page recordReadTweetPage(String tweetId) {
        var optPage = pageRepository.findTop1ByPageUniqueId(tweetId);
        Page page = null;
        if (optPage.isPresent()) {
            page = optPage.get();
            if (page.getFirstReadAt() == null) {
                page.setFirstReadAt(Instant.now());
            }
            page.setLastReadAt(Instant.now());
            page.setReadCount(ObjectUtils.defaultIfNull(page.getReadCount(), 0) + 1);
            save(page);
        }
        return page;
    }

    public List<Long> getColdDataPageIds(Instant coldDataUpdateBefore, int limit) {
        return pageRepository.getColdDataPageIds(coldDataUpdateBefore, PageRequest.ofSize(limit));
    }

    public PageOperateResult getPageOperateResult(PageQuery query) {
        Page page = null;
        if (query.getId() != null && query.getId() > 0) {
            page = pageRepository.findById(query.getId()).orElse(null);
        }
        if (page == null && StringUtils.isNotBlank(query.getUrl())) {
            page = pageRepository.findTop1ByUrl(query.getUrl()).orElse(null);
        }
        return toPageOperateResult(page);
    }

    public Page fetchFullContent(Long id) {
        var page = requireOne(id);
        String rawContent = page.getContent();
        var httpClient = HttpUtils.buildHttpClient(globalSettingService.getProxySetting());
        String content = SiteUtils.parseArticleContent(page.getUrl(), httpClient);
        if (StringUtils.isNotBlank(content)) {
            HtmlText htmlText = HtmlUtils.clean(content, page.getUrl());
            page.setContent(htmlText.getHtml());
            page.setContentText(htmlText.getText());
            page.setUpdatedAt(Instant.now());
            pageArticleContentService.saveContent(page.getId(), rawContent, ArticleContentCategory.RAW_CONTENT);
            save(page);
        }
        return page;
    }

    public Page switchRawContent(Long id) {
        var page = requireOne(id);
        var content = pageArticleContentService.findContent(page.getId(), ArticleContentCategory.RAW_CONTENT);
        if (content != null) {
            page.setContent(content.getContent());
            page.setUpdatedAt(Instant.now());
            save(page);
            pageArticleContentService.deleteById(content.getId());
        }
        return page;
    }

    /**
     * Generate and save an article summary using OpenAI
     * 
     * @param id the page ID
     * @return the updated page with the summary
     */
    public Page generateArticleSummary(Long id) {
        var page = requireOne(id);
        String content = page.getContentText();
        
        if (StringUtils.isBlank(content)) {
            // If content text is not available, use the HTML content and extract text
            content = page.getContent();
            if (StringUtils.isNotBlank(content)) {
                content = HtmlUtils.getDocText(content);
            }
        }
        
        if (StringUtils.isNotBlank(content)) {
            String summary = openAIService.generateArticleSummary(content);
            
            if (StringUtils.isNotBlank(summary)) {
                // Save the summary in the PageArticleContent table
                pageArticleContentService.saveContent(page.getId(), summary, ArticleContentCategory.SUMMARY);
                
                // Return the updated page
                return page;
            }
        }
        
        return page;
    }
}
