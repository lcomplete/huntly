package com.huntly.server.domain.vo;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/**
 * View object representing a collection group with its collections.
 */
@Data
public class CollectionGroupVO {
    private Long id;
    private String name;
    private String icon;
    private String color;
    private Integer displaySequence;
    private List<CollectionVO> collections = new ArrayList<>();
}
