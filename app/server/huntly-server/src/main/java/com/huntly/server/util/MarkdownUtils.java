package com.huntly.server.util;

import com.vladsch.flexmark.html2md.converter.FlexmarkHtmlConverter;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.safety.Safelist;

/**
 * Utilities for Markdown processing
 */
public class MarkdownUtils {

    private static final FlexmarkHtmlConverter CONVERTER = FlexmarkHtmlConverter.builder().build();

    // 最大HTML输入大小：5MB
    private static final int MAX_HTML_SIZE = 5 * 1024 * 1024;

    // 最大Markdown输出大小：10MB
    private static final int MAX_MARKDOWN_SIZE = 10 * 1024 * 1024;

    /**
     * Convert HTML content to Markdown
     *
     * @param html the HTML content to convert
     * @return the converted Markdown content
     */
    public static String htmlToMarkdown(String html) {
        if (html == null || html.isEmpty()) {
            return "";
        }

        // 安全检查：HTML输入大小限制
        if (html.length() > MAX_HTML_SIZE) {
            double sizeMB = html.length() / 1024.0 / 1024.0;
            return String.format("> ⚠️ Content too large (%.2f MB), conversion skipped\n\n" +
                    "Original HTML content is too large to convert safely.", sizeMB);
        }

        // Convert to markdown
        String markdown = CONVERTER.convert(html);

        // 安全检查：Markdown输出大小限制
        if (markdown.length() > MAX_MARKDOWN_SIZE) {
            double sizeMB = markdown.length() / 1024.0 / 1024.0;
            return String.format("> ⚠️ Converted content too large (%.2f MB), displaying truncated version\n\n" +
                    "Conversion produced extremely large output (possible bug in HTML structure).\n\n" +
                    "Original content preview:\n\n%s\n\n... (content truncated)",
                    sizeMB,
                    markdown.substring(0, Math.min(10000, markdown.length())));
        }

        return markdown;
    }
}