package com.huntly.server.connector.rss;

import com.huntly.common.util.XmlUtils;
import com.huntly.server.domain.exceptions.ConnectorFetchException;
import com.ibm.icu.text.CharsetDetector;
import com.ibm.icu.text.CharsetMatch;
import com.rometools.rome.feed.synd.SyndFeed;
import com.rometools.rome.io.FeedException;
import com.rometools.rome.io.SyndFeedInput;
import lombok.experimental.UtilityClass;
import org.apache.commons.lang3.ArrayUtils;
import org.apache.commons.lang3.StringUtils;

import java.io.IOException;
import java.io.StringReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.Charset;
import java.time.Duration;

/**
 * Utility methods related to feed handling
 * code from <a href="https://github.com/Athou/commafeed">commafeed</a> project
 */
@UtilityClass
public class FeedUtils {
    public static SyndFeed parseFeedUrl(String feedUrl, HttpClient client) {
        HttpRequest request = HttpRequest.newBuilder().GET().uri(URI.create(feedUrl))
                .build();
        HttpResponse<byte[]> response = null;
        try {
            response = client.send(request, HttpResponse.BodyHandlers.ofByteArray());
        } catch (IOException e) {
            throw new RuntimeException(e);
        } catch (InterruptedException e) {
            throw new RuntimeException(e);
        }
        var xmlBytes = response.body();
        Charset encoding = FeedUtils.guessEncoding(xmlBytes);
        String xmlString = XmlUtils.removeInvalidXmlCharacters(new String(xmlBytes, encoding));
        if (xmlString == null) {
            throw new ConnectorFetchException("xml fetch failed for url: " + feedUrl);
        }

        try {
            SyndFeed feed = new SyndFeedInput().build(new StringReader(xmlString));
            return feed;
        } catch (FeedException e) {
            throw new RuntimeException(e);
        }
    }

    public static SyndFeed parseFeedUrl(String feedUrl) {
        var client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(60))
                .followRedirects(HttpClient.Redirect.ALWAYS).build();
        return parseFeedUrl(feedUrl, client);
    }

    public static Charset guessEncoding(byte[] bytes) {
        String extracted = extractDeclaredEncoding(bytes);
        if (StringUtils.startsWithIgnoreCase(extracted, "iso-8859-")) {
            if (!StringUtils.endsWith(extracted, "1")) {
                return Charset.forName(extracted);
            }
        } else if (StringUtils.startsWithIgnoreCase(extracted, "windows-")) {
            return Charset.forName(extracted);
        }
        return detectEncoding(bytes);
    }

    public static String extractDeclaredEncoding(byte[] bytes) {
        int index = ArrayUtils.indexOf(bytes, (byte) '>');
        if (index == -1) {
            return null;
        }

        String pi = new String(ArrayUtils.subarray(bytes, 0, index + 1)).replace('\'', '"');
        index = StringUtils.indexOf(pi, "encoding=\"");
        if (index == -1) {
            return null;
        }
        String encoding = pi.substring(index + 10, pi.length());
        encoding = encoding.substring(0, encoding.indexOf('"'));
        return encoding;
    }

    public static Charset detectEncoding(byte[] bytes) {
        String encoding = "UTF-8";

        CharsetDetector detector = new CharsetDetector();
        detector.setText(bytes);
        CharsetMatch match = detector.detect();
        if (match != null) {
            encoding = match.getName();
        }
        if (encoding.equalsIgnoreCase("ISO-8859-1")) {
            encoding = "windows-1252";
        }
        return Charset.forName(encoding);
    }
}
