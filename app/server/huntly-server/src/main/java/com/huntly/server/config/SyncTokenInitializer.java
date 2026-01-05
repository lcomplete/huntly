package com.huntly.server.config;

import com.huntly.server.service.SyncTokenService;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Ensures the sync token file exists early so local desktop clients can read it from disk.
 */
@Component
@RequiredArgsConstructor
public class SyncTokenInitializer {

    private final SyncTokenService syncTokenService;

    @EventListener(ApplicationReadyEvent.class)
    public void ensureTokenCreated() {
        syncTokenService.getOrCreateToken();
    }
}

