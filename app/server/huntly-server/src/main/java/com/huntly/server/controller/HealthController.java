package com.huntly.server.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * @author lcomplete
 */
@RestController
@RequestMapping("/api/health")
public class HealthController {
    @GetMapping
    public String health() {
        return "OK";
    }
}
