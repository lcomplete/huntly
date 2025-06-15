package com.huntly.server.domain.enums;

/**
 * @author lcomplete
 */
public enum ArticleContentCategory {

    RAW_CONTENT(0);

    private final int code;

    ArticleContentCategory(int code) {
        this.code = code;
    }

    public int getCode(){
        return code;
    }
}
