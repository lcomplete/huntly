package com.huntly.interfaces.external.model;

/**
 * @author lcomplete
 * library 保存状态（保存和存档到 library 中的数据将不会被自动删除）
 */

public enum LibrarySaveStatus {
    /**
     * 未保存（自动记录到数据库中的记录）
     */
    NOT_SAVED(0),

    /**
     * 已保存
     */
    SAVED(1),

    /**
     * 已存档
     */
    ARCHIVED(2);

    private final int code;

    public int getCode() {
        return code;
    }

    LibrarySaveStatus(int code) {
        this.code = code;
    }
}
