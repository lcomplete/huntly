package com.huntly.common.exceptions;

import com.huntly.common.api.ApiCode;

/**
 * 未认证 未登陆异常
 *
 * @author lcomplete
 */
public class UnAuthorizedException extends BaseException {
    private static final long serialVersionUID = 1L;

    public UnAuthorizedException() {
        super(ApiCode.UNAUTHORIZED.getCode(), ApiCode.UNAUTHORIZED.getMessage());
    }

    public UnAuthorizedException(Throwable throwable) {
        super(ApiCode.UNAUTHORIZED.getCode(), throwable);
    }

    public UnAuthorizedException(String msg, Throwable throwable) {
        super(ApiCode.UNAUTHORIZED.getCode(), msg, throwable);
    }

    public UnAuthorizedException(String msg) {
        super(ApiCode.UNAUTHORIZED.getCode(), msg);
    }
}
