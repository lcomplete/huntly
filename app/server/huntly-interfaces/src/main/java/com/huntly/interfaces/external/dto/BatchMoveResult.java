package com.huntly.interfaces.external.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Result of batch move operation.
 *
 * @author lcomplete
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class BatchMoveResult {

    /**
     * Number of pages successfully moved.
     */
    private int successCount;

    /**
     * Total number of pages affected by the operation.
     */
    private int totalAffected;

    public static BatchMoveResult of(int successCount, int totalAffected) {
        return new BatchMoveResult(successCount, totalAffected);
    }
}

