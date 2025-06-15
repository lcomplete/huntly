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
        
        // Convert to markdown
        return CONVERTER.convert(html);
    }
}