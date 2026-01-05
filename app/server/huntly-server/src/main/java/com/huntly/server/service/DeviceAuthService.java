package com.huntly.server.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Service for OAuth 2.0 Device Authorization Grant flow.
 * Manages device codes, user codes, and their authorization status.
 */
@Service
@Slf4j
public class DeviceAuthService {

    private static final int DEVICE_CODE_LENGTH = 32;
    private static final int USER_CODE_LENGTH = 8;
    private static final long CODE_EXPIRATION_SECONDS = 600; // 10 minutes
    private static final int POLL_INTERVAL_SECONDS = 5;

    private static final String USER_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Exclude confusing chars

    private final SecureRandom secureRandom = new SecureRandom();
    private final Map<String, DeviceAuthRequest> deviceCodeMap = new ConcurrentHashMap<>();
    private final Map<String, String> userCodeToDeviceCode = new ConcurrentHashMap<>();

    /**
     * Represents a device authorization request.
     */
    public static class DeviceAuthRequest {
        private final String deviceCode;
        private final String userCode;
        private final Instant expiresAt;
        private volatile boolean authorized;
        private volatile String syncToken;
        private volatile String serverUrl;

        public DeviceAuthRequest(String deviceCode, String userCode, Instant expiresAt) {
            this.deviceCode = deviceCode;
            this.userCode = userCode;
            this.expiresAt = expiresAt;
            this.authorized = false;
        }

        public String getDeviceCode() { return deviceCode; }
        public String getUserCode() { return userCode; }
        public Instant getExpiresAt() { return expiresAt; }
        public boolean isAuthorized() { return authorized; }
        public String getSyncToken() { return syncToken; }
        public String getServerUrl() { return serverUrl; }
        public boolean isExpired() { return Instant.now().isAfter(expiresAt); }

        public void authorize(String syncToken, String serverUrl) {
            this.syncToken = syncToken;
            this.serverUrl = serverUrl;
            this.authorized = true;
        }
    }

    /**
     * Generates a new device authorization request.
     * @return DeviceAuthRequest containing device_code and user_code
     */
    public DeviceAuthRequest createDeviceAuthRequest() {
        cleanupExpired();

        String deviceCode = generateDeviceCode();
        String userCode = generateUserCode();  // Format: XXXX-XXXX
        String normalizedUserCode = userCode.replace("-", "");  // Store without dash for lookup
        Instant expiresAt = Instant.now().plusSeconds(CODE_EXPIRATION_SECONDS);

        DeviceAuthRequest request = new DeviceAuthRequest(deviceCode, userCode, expiresAt);
        deviceCodeMap.put(deviceCode, request);
        userCodeToDeviceCode.put(normalizedUserCode, deviceCode);  // Store normalized version

        log.info("[DeviceAuth] Created request: userCode={}, normalizedUserCode={}, deviceCode={}",
                userCode, normalizedUserCode, deviceCode.substring(0, 8) + "...");
        log.info("[DeviceAuth] userCodeToDeviceCode map keys: {}", userCodeToDeviceCode.keySet());

        return request;
    }

    /**
     * Authorizes a device using the user code.
     * @param userCode The user code entered by the user
     * @param syncToken The sync token to grant
     * @param serverUrl The server URL
     * @return true if authorization successful, false if user_code invalid or expired
     */
    public boolean authorizeByUserCode(String userCode, String syncToken, String serverUrl) {
        String normalizedCode = userCode.toUpperCase().replace("-", "").replace(" ", "");
        log.info("[DeviceAuth] Authorizing: input userCode={}, normalizedCode={}", userCode, normalizedCode);
        log.info("[DeviceAuth] Available keys in map: {}", userCodeToDeviceCode.keySet());

        String deviceCode = userCodeToDeviceCode.get(normalizedCode);
        log.info("[DeviceAuth] Found deviceCode: {}", deviceCode != null ? deviceCode.substring(0, 8) + "..." : "null");

        if (deviceCode == null) {
            log.warn("[DeviceAuth] No device code found for normalized user code: {}", normalizedCode);
            return false;
        }

        DeviceAuthRequest request = deviceCodeMap.get(deviceCode);
        if (request == null || request.isExpired()) {
            log.warn("[DeviceAuth] Request is null or expired");
            return false;
        }

        request.authorize(syncToken, serverUrl);
        log.info("[DeviceAuth] Authorization successful for user code: {}", userCode);
        return true;
    }

    /**
     * Checks the authorization status by device code.
     * @param deviceCode The device code
     * @return DeviceAuthRequest if found, null otherwise
     */
    public DeviceAuthRequest checkAuthorization(String deviceCode) {
        DeviceAuthRequest request = deviceCodeMap.get(deviceCode);
        if (request == null) {
            return null;
        }

        String normalizedUserCode = request.getUserCode().replace("-", "");

        if (request.isExpired()) {
            deviceCodeMap.remove(deviceCode);
            userCodeToDeviceCode.remove(normalizedUserCode);
            return null;
        }

        // If authorized, clean up
        if (request.isAuthorized()) {
            deviceCodeMap.remove(deviceCode);
            userCodeToDeviceCode.remove(normalizedUserCode);
        }

        return request;
    }

    public int getPollIntervalSeconds() {
        return POLL_INTERVAL_SECONDS;
    }

    public long getCodeExpirationSeconds() {
        return CODE_EXPIRATION_SECONDS;
    }

    private String generateDeviceCode() {
        byte[] bytes = new byte[DEVICE_CODE_LENGTH];
        secureRandom.nextBytes(bytes);
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02x", b & 0xff));
        }
        return sb.toString();
    }

    private String generateUserCode() {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < USER_CODE_LENGTH; i++) {
            int idx = secureRandom.nextInt(USER_CODE_CHARS.length());
            sb.append(USER_CODE_CHARS.charAt(idx));
        }
        // Format as XXXX-XXXX for readability
        return sb.substring(0, 4) + "-" + sb.substring(4);
    }

    private void cleanupExpired() {
        deviceCodeMap.entrySet().removeIf(entry -> {
            if (entry.getValue().isExpired()) {
                // Remove normalized user code (without dash)
                String normalizedUserCode = entry.getValue().getUserCode().replace("-", "");
                userCodeToDeviceCode.remove(normalizedUserCode);
                return true;
            }
            return false;
        });
    }
}

