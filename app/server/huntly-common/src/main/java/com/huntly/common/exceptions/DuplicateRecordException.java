package com.huntly.common.exceptions;

/**
 * 数据记录重复异常
 * @author lcomplete
 */
public class DuplicateRecordException extends BaseException {
    private static final long serialVersionUID = 1L;

    public DuplicateRecordException() {
    }

    public DuplicateRecordException(String msg) {
        super(msg);
    }

    public DuplicateRecordException(Throwable throwable) {
        super(throwable);
    }

    public DuplicateRecordException(String msg, Throwable throwable) {
        super(msg, throwable);
    }

    public DuplicateRecordException(int status, String msg) {
        super(status, msg);
    }

    public DuplicateRecordException(int status, Throwable throwable) {
        super(status, throwable);
    }

    public DuplicateRecordException(int status, String msg, Throwable throwable) {
        super(status, msg, throwable);
    }
}
