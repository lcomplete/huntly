package com.huntly.server.service;

import com.huntly.common.exceptions.NoSuchDataException;
import com.huntly.interfaces.external.dto.PageOperateResult;
import com.huntly.interfaces.external.model.LibrarySaveStatus;
import com.huntly.server.domain.entity.Page;
import com.huntly.server.domain.vo.PageDetail;
import com.huntly.server.event.EventPublisher;
import com.huntly.server.event.InboxChangedEvent;
import com.huntly.server.repository.ConnectorRepository;
import com.huntly.server.repository.PageRepository;
import com.huntly.server.repository.SourceRepository;
import org.apache.commons.lang3.ObjectUtils;
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

    private final EventPublisher eventPublisher;

    public PageService(PageRepository pageRepository, LuceneService luceneService, ConnectorRepository connectorRepository, SourceRepository sourceRepository, EventPublisher eventPublisher) {
        super(pageRepository, luceneService);
        this.connectorRepository = connectorRepository;
        this.sourceRepository = sourceRepository;
        this.eventPublisher = eventPublisher;
    }

    public void delete(Long id) {
        var page = requireOne(id);
        deleteById(id);
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
        if (Objects.equals(page.getLibrarySaveStatus(), LibrarySaveStatus.NOT_SAVED.getCode())) {
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
            pageDetail.setConnector(connectorRepository.findById(page.getConnectorId()).orElse(null));
        }
        if (page.getSourceId() != null) {
            pageDetail.setSource(sourceRepository.findById(page.getSourceId()).orElse(null));
        }
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
}
