package com.huntly.common.pagination;

import lombok.Data;

import java.io.Serializable;

@Data
public class PageParam implements Serializable {
    private static final long serialVersionUID = 1L;

    private long pageSize = 10;

    private long pageIndex = 1;

    private boolean isSearchCount = true;

    private long total;

}
