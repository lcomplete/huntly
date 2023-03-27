package com.huntly.server.util;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.experimental.UtilityClass;
import lombok.extern.slf4j.Slf4j;
import net.dankito.readability4j.Article;
import net.dankito.readability4j.Readability4J;
import org.apache.commons.lang3.StringUtils;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.select.Elements;

import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Arrays;
import java.util.List;

/**
 * @author lcomplete
 */
@UtilityClass
@Slf4j
public class SiteUtils {

    private static final List<String> ICON_MIMETYPE_BLACKLIST = Arrays.asList("application/xml", "text/html", "text/xml");
    private static final long MIN_ICON_LENGTH = 100;
    private static final long MAX_ICON_LENGTH = 100000;

    public static String removeTrailingSlash(String url) {
        if (url.endsWith("/")) {
            url = url.substring(0, url.length() - 1);
        }
        return url;
    }

    public static String getRootUrl(String url) {
        if (url == null) {
            return null;
        }
        URI uri = URI.create(url);
        String rootUrl = uri.getScheme() + "://" + uri.getHost();
        if (uri.getPort() != -1) {
            rootUrl += ":" + uri.getPort();
        }
        return rootUrl;
    }

    @RequiredArgsConstructor
    @Getter
    public static class Favicon {
        private final String iconUrl;

        private final byte[] icon;
        private final String mediaType;
    }

    public static Favicon getFaviconFromHome(String url, HttpClient client) {
        if (url == null) {
            return null;
        }
        url = getRootUrl(url);
        Favicon icon = getIconInPage(url, client);
        if (icon != null) {
            return icon;
        }
        icon = getIconAtRoot(url, client);
        if (icon != null) {
            return icon;
        }
        return null;
    }

    private static Favicon getIconAtRoot(String url, HttpClient client) {
        url = removeTrailingSlash(url) + "/favicon.ico";
        return getFaviconFromIconUrl(url, client);
    }

    private static HttpClient createHttpClient() {
        return HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10))
                .followRedirects(HttpClient.Redirect.ALWAYS).build();
    }

    private static Favicon getFaviconFromIconUrl(String iconUrl, HttpClient client) {
        byte[] bytes = null;
        String contentType = null;

        try {
            log.debug("getting icon at {}", iconUrl);
            HttpRequest request = HttpRequest.newBuilder().GET().uri(URI.create(iconUrl)).build();
            HttpResponse<byte[]> response = client.send(request, HttpResponse.BodyHandlers.ofByteArray());
            bytes = response.body();
            contentType = response.headers().firstValue("Content-Type").orElse(null);
        } catch (Exception e) {
            log.debug("Failed to retrieve for url {}: ", iconUrl);
            log.trace("Failed to retrieve for url {}: ", iconUrl, e);
        }

        if (!isValidIconResponse(bytes, contentType)) {
            return null;
        }
        return new Favicon(iconUrl, bytes, contentType);
    }

    private Favicon getIconInPage(String url, HttpClient client) {
        Document doc = null;
        try {
            HttpRequest request = HttpRequest.newBuilder().GET().uri(URI.create(url)).build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            doc = Jsoup.parse(response.body(), url);
        } catch (Exception e) {
            log.debug("Failed to retrieve page to find icon");
            log.trace("Failed to retrieve page to find icon", e);
            return null;
        }

        Elements icons = doc.select("link[rel~=(?i)^(shortcut|icon|shortcut icon)$]");

        if (icons.isEmpty()) {
            log.debug("No icon found in page {}", url);
            return null;
        }

        String href = icons.get(0).attr("abs:href");
        if (StringUtils.isBlank(href)) {
            log.debug("No icon found in page");
            return null;
        }

        log.debug("Found unconfirmed iconInPage at {}", href);

        return getFaviconFromIconUrl(href, client);
    }

    private static boolean isValidIconResponse(byte[] content, String contentType) {
        if (content == null) {
            return false;
        }

        long length = content.length;
        if (StringUtils.isNotBlank(contentType)) {
            contentType = contentType.split(";")[0];
        }
        if (ICON_MIMETYPE_BLACKLIST.contains(contentType)) {
            log.debug("Content-Type {} is blacklisted", contentType);
            return false;
        }
        if (length < MIN_ICON_LENGTH) {
            log.debug("Length {} below MIN_ICON_LENGTH {}", length, MIN_ICON_LENGTH);
            return false;
        }
        if (length > MAX_ICON_LENGTH) {
            log.debug("Length {} greater than MAX_ICON_LENGTH {}", length, MAX_ICON_LENGTH);
            return false;
        }

        return true;
    }

    public static String parseArticleContent(String url, HttpClient client) {
        try {
            HttpRequest request = null;
            try {
                request = HttpRequest.newBuilder().uri(new URI(url))
                        .header("User-Agent", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36")
                        .build();
            } catch (URISyntaxException e) {
                throw new RuntimeException(e);
            }
            HttpResponse<String> response = null;
            try {
                response = client.send(request, HttpResponse.BodyHandlers.ofString());
            } catch (IOException e) {
                throw new RuntimeException(e);
            } catch (InterruptedException e) {
                throw new RuntimeException(e);
            }
            var responseText = response.body();

            //HTMLDocument htmlDoc = new HTMLDocument(responseText);
            //
            //BoilerpipeExtractor extractor = CommonExtractors.ARTICLE_EXTRACTOR;
            //TextDocument textDoc = new BoilerpipeSAXInput(htmlDoc.toInputSource()).getTextDocument();
            //extractor.process(textDoc);
            //
            //HTMLHighlighter highlighter = HTMLHighlighter.newExtractingInstance();
            //highlighter.setOutputHighlightOnly(true);
            //String article = highlighter.process(textDoc, htmlDoc.toInputSource());

            Readability4J readability4J = new Readability4J(url, responseText);
            Article article = readability4J.parse();

            return article.getContentWithUtf8Encoding();
        } catch (Exception e) {
            log.error("Error parsing article content", e);
            return null;
        }
    }
}
