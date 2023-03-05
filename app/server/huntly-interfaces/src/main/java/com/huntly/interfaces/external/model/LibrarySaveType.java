package com.huntly.interfaces.external.model;

/**
 * @author lcomplete
 */

public enum LibrarySaveType {
    NONE(0),
    MY_LIST(1),
    STARRED(2),
    READ_LATER(3),
    ARCHIVE(4);
    
    private final int code;

    LibrarySaveType(int code) {
        this.code = code;
    }
    
    private int getCode() {
        return code;
    }

    public static LibrarySaveType fromCode(Integer code) {
        if (code == null) {
            return null;
        }
        var types = LibrarySaveType.class.getEnumConstants();
        for (var saveType : types) {
            if (code.equals(saveType.getCode())) {
                return saveType;
            }
        }
        return null;
    }
}
