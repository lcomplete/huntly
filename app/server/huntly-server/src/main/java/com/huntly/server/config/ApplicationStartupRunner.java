package com.huntly.server.config;

import com.huntly.server.service.ArticleShortcutService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/**
 * Runs initialization tasks after the application has started
 */
@Slf4j
@Component
public class ApplicationStartupRunner implements ApplicationRunner {

    private final ArticleShortcutService articleShortcutService;

    public ApplicationStartupRunner(ArticleShortcutService articleShortcutService) {
        this.articleShortcutService = articleShortcutService;
    }

    @Override
    public void run(ApplicationArguments args) {
        log.info("Application started, initializing default shortcuts if needed");
        articleShortcutService.initializeDefaultShortcuts();
    }
}
