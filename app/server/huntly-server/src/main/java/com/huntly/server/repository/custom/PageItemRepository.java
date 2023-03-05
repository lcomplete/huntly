package com.huntly.server.repository.custom;

import com.huntly.interfaces.external.dto.PageItem;
import com.huntly.interfaces.external.query.PageListQuery;

import java.util.List;

/**
 * @author lcomplete
 */
public interface PageItemRepository {
    List<PageItem> list(PageListQuery listQuery);
}
