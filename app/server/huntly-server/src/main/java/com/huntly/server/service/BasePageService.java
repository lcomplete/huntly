package com.huntly.server.service;

import com.huntly.server.domain.entity.Page;
import com.huntly.server.repository.PageRepository;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

/**
 * @author lcomplete
 */
public abstract class BasePageService {

    protected PageRepository pageRepository;

    LuceneService luceneService;

    protected BasePageService(PageRepository pageRepository, LuceneService luceneService) {
        this.pageRepository = pageRepository;
        this.luceneService = luceneService;
    }

    //@Transactional(rollbackFor = Exception.class)
    protected Page save(Page page) {
        page.setUpdatedAt(Instant.now());
        pageRepository.save(page);
        luceneService.indexPage(page);
        return page;
    }
    
    protected void deleteById(Long id){
        pageRepository.deleteById(id);
        luceneService.deletePage(id);
    }
}
