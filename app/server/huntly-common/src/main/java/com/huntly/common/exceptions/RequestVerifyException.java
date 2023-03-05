package com.huntly.common.exceptions;

/**
 * 请求验证不通过异常
 * @author lcomplete
 */
public class RequestVerifyException extends BaseException {

    private static final long serialVersionUID = 1L;

    public RequestVerifyException() {
    }

    public RequestVerifyException(String msg) {
        super(msg);
    }

    public RequestVerifyException(Throwable throwable) {
        super(throwable);
    }

    public RequestVerifyException(String msg, Throwable throwable) {
        super(msg, throwable);
    }

    public RequestVerifyException(int status, String msg) {
        super(status, msg);
    }

    public RequestVerifyException(int status, Throwable throwable) {
        super(status, throwable);
    }

    public RequestVerifyException(int status, String msg, Throwable throwable) {
        super(status, msg, throwable);
    }
}
