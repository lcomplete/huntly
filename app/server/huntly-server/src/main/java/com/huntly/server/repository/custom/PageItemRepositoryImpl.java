package com.huntly.server.repository.custom;

import com.huntly.interfaces.external.dto.PageItem;
import com.huntly.interfaces.external.query.PageListQuery;
import org.springframework.stereotype.Repository;

import javax.persistence.EntityManager;
import javax.persistence.PersistenceContext;
import java.util.List;

@Repository
public class PageItemRepositoryImpl implements PageItemRepository {
    
    @PersistenceContext
    private EntityManager entityManager;
    
    @Override
    public List<PageItem> list(PageListQuery listQuery) {
        return null;
    }
}
