package com.huntly.common.util;

import lombok.experimental.UtilityClass;

import java.net.MalformedURLException;
import java.net.URI;
import java.net.URL;

/**
 * @author lcomplete
 */
@UtilityClass
public class UrlUtils {

    public static String getDomainName(String url) {
        try {
            URI uri = new URI(url);
            return uri.getHost();
        } catch (Exception ex) {
            return "";
        }
    }

    public static boolean isHttpUrl(String url) {
        URL uri = null;
        try {
            uri = new URL(url);
        } catch (MalformedURLException e) {
            return false;
        }
        var protocol = uri.getProtocol();
        return "http".equals(protocol);
    }

    public static boolean isHttpsUrl(String url) {
        URL uri = null;
        try {
            uri = new URL(url);
        } catch (MalformedURLException e) {
            return false;
        }
        var protocol = uri.getProtocol();
        return "https".equals(protocol);
    }
    
    public static String getHttpsUrl(String httpUrl){
        return httpUrl.replaceFirst("^http:","https:");
    }
    
    public static String getHttpUrl(String httpsUrl){
        return httpsUrl.replaceFirst("^https:","http:");
    }

}
