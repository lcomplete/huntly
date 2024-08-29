package com.huntly.server.util;

import com.huntly.server.domain.model.ProxySetting;
import lombok.experimental.UtilityClass;
import org.apache.commons.lang3.StringUtils;

import javax.net.ssl.KeyManager;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import java.net.InetSocketAddress;
import java.net.ProxySelector;
import java.net.http.HttpClient;
import java.security.KeyManagementException;
import java.security.NoSuchAlgorithmException;
import java.security.cert.CertificateException;
import java.security.cert.X509Certificate;
import java.time.Duration;

/**
 * @author lcomplete
 */
@UtilityClass
public class HttpUtils {
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
