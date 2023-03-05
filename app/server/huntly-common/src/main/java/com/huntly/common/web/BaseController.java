package com.huntly.common.web;

import com.huntly.common.api.ApiCode;
import com.huntly.common.api.ApiResult;

import java.util.Map;

/**
 * @author lcomplete
 */
public abstract class BaseController {

    public ApiResult<Boolean> result(boolean flag) {
        return ApiResult.result(flag);
    }

    public ApiResult<Boolean> result(ApiCode apiCode) {
        return ApiResult.result(apiCode);
    }

    public <T> ApiResult<T> result(ApiCode apiCode, T data) {
        return ApiResult.result(apiCode, data);
    }

    public <T> ApiResult<T> result(ApiCode apiCode, String message, T data) {
        return ApiResult.result(apiCode, message, data);
    }

    public ApiResult<Boolean> ok() {
        return ApiResult.ok(null);
    }

    public <T> ApiResult<T> ok(T data) {
        return ApiResult.ok(data);
    }

    public <T> ApiResult<T> ok(T data, String message) {
        return ApiResult.ok(data, message);
    }

    public ApiResult<Map<String, Object>> okMap(String key, Object value) {
        return ApiResult.okMap(key, value);
    }

    public ApiResult<Boolean> fail(ApiCode apiCode) {
        return ApiResult.fail(apiCode);
    }

    public ApiResult<String> fail(String message) {
        return ApiResult.fail(message);
    }

    public <T> ApiResult<T> fail(ApiCode apiCode, T data) {
        return ApiResult.fail(apiCode, data);
    }

    public ApiResult<String> fail(Integer errorCode, String message) {
        return ApiResult.fail(errorCode, message);
    }

    public ApiResult<Map<String, Object>> fail(String key, Object value) {
        return ApiResult.fail(key, value);
    }

    public ApiResult<Boolean> fail() {
        return ApiResult.fail();
    }
}
