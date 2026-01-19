package com.huntly.server.domain.vo;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/**
 * Response for the collections tree API endpoint.
 */
@Data
public class CollectionTreeVO {
    private Long unsortedCount;
    private List<CollectionGroupVO> groups = new ArrayList<>();
}
