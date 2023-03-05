package com.huntly.common.exceptions;

/**
 * 数据不存在异常
 * @author lcomplete
 */
public class NoSuchDataException extends BaseException {
    private static final long serialVersionUID = 1L;

    public NoSuchDataException() {
    }

    public NoSuchDataException(String msg) {
        super(msg);
    }

    public NoSuchDataException(Throwable throwable) {
        super(throwable);
    }

    public NoSuchDataException(String msg, Throwable throwable) {
        super(msg, throwable);
    }

    public NoSuchDataException(int status, String msg) {
        super(status, msg);
    }

    public NoSuchDataException(int status, Throwable throwable) {
        super(status, throwable);
    }

    public NoSuchDataException(int status, String msg, Throwable throwable) {
        super(status, msg, throwable);
    }
}
