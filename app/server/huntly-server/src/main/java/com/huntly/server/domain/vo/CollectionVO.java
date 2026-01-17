package com.huntly.server.domain.vo;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/**
 * View object representing a collection with its page count and children.
 */
@Data
public class CollectionVO {
    private Long id;
    private Long groupId;
    private Long parentId;
    private String name;
    private String icon;
    private String color;
    private Integer displaySequence;
    private Long pageCount;
    private List<CollectionVO> children = new ArrayList<>();
}
