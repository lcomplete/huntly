package com.huntly.server.page;

import com.huntly.common.util.TextUtils;
import com.huntly.server.util.HtmlText;
import com.huntly.server.util.HtmlUtils;
import org.apache.commons.lang3.StringUtils;

public class ContentCleaner {
    private final String content;

    private final String description;

    private final String baseUri;

    private String cleanHtml;

    private String cleanDescription;

    private String cleanText;

    public ContentCleaner(String content, String description, String baseUri) {
        this.content = content;
        this.description = description;
        this.baseUri = baseUri;
        
        extract();
    }

    private void extract() {
        boolean hasContent = StringUtils.isNotBlank(content);
        boolean hasDescription = StringUtils.isNotBlank(description);
        if (!hasContent && !hasDescription) {
            return;
        }
        HtmlText htmlText = HtmlUtils.clean(hasContent ? content : description, baseUri);
        cleanDescription = hasDescription ? HtmlUtils.clean(this.description, baseUri).getText() : TextUtils.trimTruncate(htmlText.getText(), 512);
        cleanHtml = htmlText.getHtml();
        cleanText = htmlText.getText();
    }

    public String getCleanHtml() {
        return cleanHtml;
    }

    public String getCleanDescription() {
        return cleanDescription;
    }

    public String getCleanText() {
        return cleanText;
    }
}
