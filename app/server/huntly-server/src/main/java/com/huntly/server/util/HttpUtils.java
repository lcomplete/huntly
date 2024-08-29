package com.huntly.server.util;

import com.huntly.server.domain.constant.AppConstants;
import com.huntly.server.domain.model.ProxySetting;
import lombok.experimental.UtilityClass;
import okhttp3.Cache;
import okhttp3.ConnectionSpec;
import okhttp3.OkHttpClient;
import org.apache.commons.lang3.StringUtils;

import javax.net.ssl.KeyManager;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import java.io.File;
import java.net.InetSocketAddress;
import java.net.Proxy;
import java.net.ProxySelector;
import java.net.http.HttpClient;
import java.security.KeyManagementException;
import java.security.NoSuchAlgorithmException;
import java.security.cert.CertificateException;
import java.security.cert.X509Certificate;
import java.time.Duration;
import java.util.Arrays;

/**
 * @author lcomplete
 */
@UtilityClass
public class HttpUtils {
    public static OkHttpClient buildFeedOkHttpClient(ProxySetting proxySetting, Integer timeoutSeconds) {
        var builder = new OkHttpClient.Builder()
                .cache(new Cache(
                        new File(AppConstants.HTTP_FEED_CACHE_DIR), AppConstants.HTTP_FEED_CACHE_MAXSIZE
                ))
                .connectionSpecs(Arrays.asList(ConnectionSpec.MODERN_TLS, ConnectionSpec.COMPATIBLE_TLS, ConnectionSpec.CLEARTEXT))
                .followRedirects(true);
        if (proxySetting != null && StringUtils.isNotBlank(proxySetting.getHost())) {
            builder = builder.proxy(
                    new Proxy(
                            Proxy.Type.HTTP,
                            new InetSocketAddress(proxySetting.getHost(), proxySetting.getPort())
                    )
            );
        }
        if (timeoutSeconds != null) {
            builder = builder.callTimeout(Duration.ofSeconds(timeoutSeconds));
        }
        return builder.build();
    }

    public static OkHttpClient buildFeedOkHttpClient(ProxySetting proxySetting) {
        return buildFeedOkHttpClient(proxySetting, 30);
    }

    public static HttpClient buildHttpClient(ProxySetting proxySetting, Integer timeoutSeconds) {
        // Configure SSLContext with a TrustManager that accepts any certificate
        SSLContext sslContext = null;
        try {
            sslContext = SSLContext.getInstance("TLS");
            sslContext.init(new KeyManager[0], new TrustManager[]{new DefaultTrustManager()}, null);
        } catch (NoSuchAlgorithmException | KeyManagementException e) {
            throw new RuntimeException(e);
        }

        var clientBuilder = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(timeoutSeconds))
                .sslContext(sslContext)
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

    private static class DefaultTrustManager implements X509TrustManager {

        @Override
        public void checkClientTrusted(X509Certificate[] arg0, String arg1) throws CertificateException {
        }

        @Override
        public void checkServerTrusted(X509Certificate[] arg0, String arg1) throws CertificateException {
        }

        @Override
        public X509Certificate[] getAcceptedIssuers() {
            return null;
        }
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
