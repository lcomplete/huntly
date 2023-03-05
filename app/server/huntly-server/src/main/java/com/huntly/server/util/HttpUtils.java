package com.huntly.server.util;

import com.huntly.server.domain.model.ProxySetting;
import lombok.experimental.UtilityClass;
import org.apache.commons.lang3.StringUtils;

import java.net.InetSocketAddress;
import java.net.ProxySelector;
import java.net.http.HttpClient;
import java.time.Duration;

/**
 * @author lcomplete
 */
@UtilityClass
public class HttpUtils {
    public static HttpClient buildHttpClient(ProxySetting proxySetting, Integer timeoutSeconds) {
        var clientBuilder = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(timeoutSeconds))
                .followRedirects(HttpClient.Redirect.ALWAYS);
        if (proxySetting != null && StringUtils.isNotBlank(proxySetting.getHost())) {
            clientBuilder = clientBuilder.proxy(
                    ProxySelector.of(
                            new InetSocketAddress(proxySetting.getHost(), proxySetting.getPort())
                    )
            );
        }
        return clientBuilder.build();
    }

    /**
     * default timeout set to 30 seconds
     *
     * @param proxySetting
     * @return
     */
    public static HttpClient buildHttpClient(ProxySetting proxySetting) {
        return buildHttpClient(proxySetting, 30);
    }
}
