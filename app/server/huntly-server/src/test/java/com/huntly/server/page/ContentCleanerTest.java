package com.huntly.server.page;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.*;

class ContentCleanerTest {

    @Test
    void getCleanHtml_Styled() {
        ContentCleaner cleaner = new ContentCleaner("<div style='color:red;'>test</div>","desc","http://codelc.com");
        //System.out.println(cleaner.getCleanHtml());
        assertThat(cleaner.getCleanHtml()).contains("style");
    }

    @Test
    void getCleanHtml_SpanStyled() {
        ContentCleaner cleaner = new ContentCleaner("<span style='color:red;'>test</div>","desc","http://codelc.com");
        //System.out.println(cleaner.getCleanHtml());
        assertThat(cleaner.getCleanHtml()).contains("span");
        assertThat(cleaner.getCleanHtml()).contains("style");
    }

    @Test
    void getCleanDescription() {
    }

    @Test
    void getCleanText() {
    }
}