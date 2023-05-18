package com.huntly.server.util;

import com.google.common.primitives.Ints;
import lombok.experimental.UtilityClass;
import org.apache.commons.lang3.StringUtils;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.safety.Cleaner;
import org.jsoup.safety.Safelist;

import java.util.Arrays;
import java.util.stream.Collectors;

/**
 * @author lcomplete
 */
@UtilityClass
public class HtmlUtils {
    /**
     * 使用自带的白名单
     */
    private static final Safelist SAFE_LIST = buildSafeList();

    public HtmlText clean(String contentHtml, String baseUri) {
        HtmlText htmlText = new HtmlText();
        if (StringUtils.isNotBlank(contentHtml) && StringUtils.isNotBlank(baseUri)) {
            Document doc = Jsoup.parseBodyFragment(contentHtml, baseUri);
            Cleaner cleaner = new Cleaner(SAFE_LIST);
            Document clean = cleaner.clean(doc);
            htmlText.setHtml(clean.body().html());
            htmlText.setText(clean.text());
        }

        return htmlText;
    }

    public String getDocText(String contentHtml) {
        if (StringUtils.isNotBlank(contentHtml)) {
            Document doc = Jsoup.parseBodyFragment(contentHtml);
            return doc.text();
        }
        return "";
    }

    private static synchronized Safelist buildSafeList() {
        Safelist whitelist = new Safelist();
        String[] tags = {"a", "b", "blockquote", "br", "caption", "cite", "code", "col", "colgroup", "dd", "div", "dl", "dt", "em", "h1",
                "h2", "h3", "h4", "h5", "h6", "i", "iframe", "img", "li", "ol", "p", "pre", "q", "small", "strike", "strong", "sub", "sup",
                "table", "tbody", "td", "tfoot", "th", "thead", "tr", "u", "ul", "article", "span", "section"};
        whitelist.addTags(tags);
        for (String tag : tags) {
            addCommonAttributes(whitelist, tag, "style");
        }

        addCommonAttributes(whitelist, "div", "dir");
        addCommonAttributes(whitelist, "pre", "dir");
        addCommonAttributes(whitelist, "code", "dir");
        addCommonAttributes(whitelist, "table", "dir");
        addCommonAttributes(whitelist, "p", "dir");
        addCommonAttributes(whitelist, "a", "href", "title");
        addCommonAttributes(whitelist, "blockquote", "cite");
        addCommonAttributes(whitelist, "col", "span", "width");
        addCommonAttributes(whitelist, "colgroup", "span", "width");
        addCommonAttributes(whitelist, "iframe", "src", "height", "width", "allowfullscreen", "frameborder", "style");
        addCommonAttributes(whitelist, "img", "align", "alt", "height", "src", "title", "width", "style");
        addCommonAttributes(whitelist, "ol", "start", "type");
        addCommonAttributes(whitelist, "q", "cite");
        addCommonAttributes(whitelist, "table", "border", "bordercolor", "summary", "width", "cellpadding", "cellspacing", "align");
        addCommonAttributes(whitelist, "td", "border", "bordercolor", "abbr", "axis", "colspan", "rowspan", "width", "height");
        addCommonAttributes(whitelist, "th", "border", "bordercolor", "abbr", "axis", "colspan", "rowspan", "scope", "width");
        addCommonAttributes(whitelist, "ul", "type");

        whitelist.addProtocols("a", "href", "ftp", "http", "https", "magnet", "mailto");
        whitelist.addProtocols("blockquote", "cite", "http", "https");
        whitelist.addProtocols("img", "src", "http", "https");
        whitelist.addProtocols("q", "cite", "http", "https");

        whitelist.addEnforcedAttribute("a", "target", "_blank");
        whitelist.addEnforcedAttribute("a", "rel", "noreferrer");
        return whitelist;
    }

    private static void addCommonAttributes(Safelist safelist, String tag, String... attributes) {
        var attrs = Arrays.stream(attributes).collect(Collectors.toList());
        if (!attrs.contains("style")) {
            attrs.add("style");
        }
        if (!attrs.contains("width")) {
            attrs.add("width");
        }
        if (!attrs.contains("height")) {
            attrs.add("height");
        }
        safelist.addAttributes(tag, attrs.toArray(String[]::new));
    }

    public static String findFirstPictureUrl(String content) {
        if (StringUtils.isBlank(content)) {
            return "";
        }
        Document doc = Jsoup.parseBodyFragment(content);
        var images = doc.select("img");
        for (Element img : images) {
            var src = img.attr("src");
            var width = Ints.tryParse(img.attr("width"));
            var height = Ints.tryParse(img.attr("height"));
            boolean isValidPicture = StringUtils.isNotBlank(src) && !src.endsWith(".gif") &&
                    (width == null || width > 100) && (height == null || height > 100);
            if (isValidPicture) {
                return src;
            }
        }
        return "";
    }
}
