package com.huntly.interfaces.external.dto;

import lombok.Data;

/**
 * @author lcomplete
 */
@Data
public class PageOperateResult {
    private Long id;

    private Integer librarySaveStatus;

    private Boolean starred;

    private Boolean readLater;
}
