package com.huntly.common.api;

/**
 * <p>
 * REST API 响应码
 * </p>
 *
 */
public enum ApiCode {

    /**
     * 操作成功
     **/
    SUCCESS(0, "操作成功"),
    /**
     * 非法访问 未登录
     **/
    UNAUTHORIZED(401, "非法访问"),
    /**
     * 没有权限
     **/
    NO_PERMISSION(403, "没有权限"),
    /**
     * 你请求的资源不存在
     **/
    NOT_FOUND(404, "你请求的资源不存在"),
    /**
     * 操作失败
     **/
    FAIL(500, "操作失败"),
    /**
     * 登录失败
     **/
    LOGIN_EXCEPTION(4000, "登录失败"),
    /**
     * 数据记录重复
     */
    DUPLICATE_RECORD(4001,"数据记录重复"),
    /**
     * 系统异常
     **/
    SYSTEM_EXCEPTION(5000, "系统异常"),
    /**
     * 请求参数校验异常
     **/
    PARAMETER_EXCEPTION(5001, "请求参数校验异常"),
    /**
     * 请求参数解析异常
     **/
    PARAMETER_PARSE_EXCEPTION(5002, "请求参数解析异常"),
    /**
     * HTTP内容类型异常
     **/
    HTTP_MEDIA_TYPE_EXCEPTION(5003, "HTTP内容类型异常"),

    /**
     * 业务处理异常
     **/
    BUSINESS_EXCEPTION(5101, "业务处理异常"),
    /**
     * 数据库处理异常
     **/
    DAO_EXCEPTION(5102, "数据库处理异常"),
    /**
     * 验证码校验异常
     **/
    VERIFICATION_CODE_EXCEPTION(5103, "验证码校验异常"),
    /**
     * 登录授权异常
     **/
    AUTHENTICATION_EXCEPTION(5104, "登录授权异常"),
    /**
     * 没有登陆异常
     **/
    UNAUTHENTICATED_EXCEPTION(5105, "没有登陆异常"),
    /**
     * JWT Token解析异常
     **/
    JWTDECODE_EXCEPTION(5107, "Token解析异常"),
    /**
     * http请求方法不支持
     */
    HTTP_REQUEST_METHOD_NOT_SUPPORTED_EXCEPTION(5108, "METHOD NOT SUPPORTED"),

    ;

    private final int code;
    private final String message;

    ApiCode(final int code, final String message) {
        this.code = code;
        this.message = message;
    }

    public static ApiCode getApiCode(int code) {
        ApiCode[] ecs = ApiCode.values();
        for (ApiCode ec : ecs) {
            if (ec.getCode() == code) {
                return ec;
            }
        }
        return SUCCESS;
    }

    public int getCode() {
        return code;
    }

    public String getMessage() {
        return message;
    }

}
