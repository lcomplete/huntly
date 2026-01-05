package com.huntly.server.controller;

import com.huntly.common.api.ApiResult;
import com.huntly.interfaces.external.dto.LoginUserInfo;
import com.huntly.interfaces.external.model.LoginRequest;
import com.huntly.server.domain.constant.AppConstants;
import com.huntly.server.security.jwt.JwtUtils;
import com.huntly.server.service.UserService;
import com.huntly.server.service.SyncTokenService;
import com.huntly.server.service.DeviceAuthService;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.Cookie;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.validation.Valid;
import java.security.Principal;

/**
 * @author lcomplete
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final UserService userService;

    private final JwtUtils jwtUtils;

    private final AuthenticationManager authenticationManager;

    private final SyncTokenService syncTokenService;

    private final DeviceAuthService deviceAuthService;

    public AuthController(
            UserService userService,
            JwtUtils jwtUtils,
            AuthenticationManager authenticationManager,
            SyncTokenService syncTokenService,
            DeviceAuthService deviceAuthService
    ) {
        this.userService = userService;
        this.jwtUtils = jwtUtils;
        this.authenticationManager = authenticationManager;
        this.syncTokenService = syncTokenService;
        this.deviceAuthService = deviceAuthService;
    }

    @PostMapping("/signin")
    public ApiResult<String> signin(@RequestBody @Valid LoginRequest loginRequest, HttpServletResponse response) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(loginRequest.getUsername(), loginRequest.getPassword()));
        SecurityContextHolder.getContext().setAuthentication(authentication);
        userService.updateLastLoginAt(loginRequest.getUsername());
        
        String jwt = jwtUtils.generateJwtToken(authentication);
        addJwtToCookie(response, jwt);
        return ApiResult.ok(jwt);
    }

    private void addJwtToCookie(HttpServletResponse response, String jwt) {
        Cookie cookie = new Cookie(AppConstants.AUTH_TOKEN_COOKIE_NAME, jwt);
        cookie.setHttpOnly(true);
        cookie.setPath("/");
        cookie.setMaxAge(jwtUtils.getJwtExpirationSeconds());
        response.addCookie(cookie);
    }

    @PostMapping("/signup")
    public ApiResult<String> signup(@RequestBody @Valid LoginRequest loginRequest) {
        userService.createUser(loginRequest.getUsername(), loginRequest.getPassword());
        return ApiResult.ok("User registered successfully!");
    }

    @PostMapping("/signOut")
    public ApiResult<String> singOut(HttpServletRequest request, HttpServletResponse response) {
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie cookie : cookies) {
                if (cookie.getName().equals(AppConstants.AUTH_TOKEN_COOKIE_NAME)) {
                    cookie.setMaxAge(0);
                    cookie.setPath("/");
                    response.addCookie(cookie);
                }
            }
        }
        return ApiResult.ok("logout success");
    }
    
    @GetMapping("/loginUserInfo")
    public LoginUserInfo loginUserInfo(Principal principal) {
        LoginUserInfo userInfo= new LoginUserInfo();
        if(principal!=null){
            userInfo.setUsername(principal.getName());
        }
        return userInfo;
    }
    
    @GetMapping("/isUserSet")
    public ApiResult<Boolean> isUserSet(){
        return ApiResult.ok(userService.isUserSet());
    }

    // ==================== Device Authorization Grant Flow ====================

    /**
     * Step 1: Desktop app requests device and user codes.
     * POST /api/auth/desktop/device
     */
    @PostMapping("/desktop/device")
    public ApiResult<DeviceCodeResponse> requestDeviceCode() {
        DeviceAuthService.DeviceAuthRequest request = deviceAuthService.createDeviceAuthRequest();
        return ApiResult.ok(new DeviceCodeResponse(
                request.getDeviceCode(),
                request.getUserCode(),
                deviceAuthService.getCodeExpirationSeconds(),
                deviceAuthService.getPollIntervalSeconds()
        ));
    }

    /**
     * Step 2: User authorizes in browser with user code.
     * POST /api/auth/desktop/authorize
     */
    @PostMapping("/desktop/authorize")
    public ApiResult<String> authorizeDevice(
            @RequestBody DeviceAuthorizeRequest authorizeRequest,
            HttpServletRequest request,
            Principal principal
    ) {
        if (principal == null) {
            return ApiResult.fail(401, "Not authenticated");
        }

        String userCode = authorizeRequest.getUserCode();
        if (userCode == null || userCode.isBlank()) {
            return ApiResult.fail(400, "user_code is required");
        }

        String baseUrl = request.getScheme() + "://" + request.getServerName();
        if (!(request.getScheme().equals("http") && request.getServerPort() == 80)
                && !(request.getScheme().equals("https") && request.getServerPort() == 443)) {
            baseUrl = baseUrl + ":" + request.getServerPort();
        }

        String syncToken = syncTokenService.getOrCreateToken();
        boolean success = deviceAuthService.authorizeByUserCode(userCode, syncToken, baseUrl);

        if (success) {
            return ApiResult.ok("Authorization successful");
        } else {
            return ApiResult.fail(400, "Invalid or expired user code");
        }
    }

    /**
     * Step 3: Desktop app polls for token.
     * POST /api/auth/desktop/token
     */
    @PostMapping("/desktop/token")
    public ApiResult<?> pollDeviceToken(
            @RequestBody DeviceTokenRequest tokenRequest
    ) {
        String deviceCode = tokenRequest.getDeviceCode();
        if (deviceCode == null || deviceCode.isBlank()) {
            return ApiResult.fail(400, "device_code is required");
        }

        DeviceAuthService.DeviceAuthRequest request = deviceAuthService.checkAuthorization(deviceCode);

        if (request == null) {
            return ApiResult.fail(400, "Invalid or expired device code");
        }

        if (!request.isAuthorized()) {
            // Authorization pending - client should continue polling
            return ApiResult.fail(428, "authorization_pending");
        }

        // Authorization complete
        return ApiResult.ok(new DeviceTokenResponse(
                request.getSyncToken(),
                request.getServerUrl()
        ));
    }

    // ==================== Request/Response DTOs ====================

    public static class DeviceCodeResponse {
        private final String deviceCode;
        private final String userCode;
        private final long expiresIn;
        private final int interval;

        public DeviceCodeResponse(String deviceCode, String userCode, long expiresIn, int interval) {
            this.deviceCode = deviceCode;
            this.userCode = userCode;
            this.expiresIn = expiresIn;
            this.interval = interval;
        }

        @com.fasterxml.jackson.annotation.JsonProperty("device_code")
        public String getDeviceCode() { return deviceCode; }

        @com.fasterxml.jackson.annotation.JsonProperty("user_code")
        public String getUserCode() { return userCode; }

        @com.fasterxml.jackson.annotation.JsonProperty("expires_in")
        public long getExpiresIn() { return expiresIn; }

        public int getInterval() { return interval; }
    }

    public static class DeviceAuthorizeRequest {
        private String userCode;

        @com.fasterxml.jackson.annotation.JsonProperty("user_code")
        public String getUserCode() { return userCode; }
        public void setUserCode(String userCode) { this.userCode = userCode; }
    }

    public static class DeviceTokenRequest {
        private String deviceCode;

        @com.fasterxml.jackson.annotation.JsonProperty("device_code")
        public String getDeviceCode() { return deviceCode; }
        public void setDeviceCode(String deviceCode) { this.deviceCode = deviceCode; }
    }

    public static class DeviceTokenResponse {
        private final String syncToken;
        private final String serverUrl;

        public DeviceTokenResponse(String syncToken, String serverUrl) {
            this.syncToken = syncToken;
            this.serverUrl = serverUrl;
        }

        @com.fasterxml.jackson.annotation.JsonProperty("sync_token")
        public String getSyncToken() { return syncToken; }

        @com.fasterxml.jackson.annotation.JsonProperty("server_url")
        public String getServerUrl() { return serverUrl; }
    }
}
