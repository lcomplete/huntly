package com.huntly.interfaces.external.dto;

import lombok.Data;

import java.time.Instant;
import java.util.List;

/**
 * @author lcomplete
 */
@Data
public class CursorPageResult {
    private Instant firstId;
    
    private Instant lastId;
    
    List<PageItem> pageItems;
}
