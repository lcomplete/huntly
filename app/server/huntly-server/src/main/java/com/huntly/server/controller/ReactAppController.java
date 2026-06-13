package com.huntly.server.controller;

import io.swagger.v3.oas.annotations.Hidden;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;

/**
 * Forward non-API, non-static requests to React SPA index.html.
 * Requires ant_path_matcher for the ** pattern in the middle of paths.
 *
 * @author lcomplete
 */
@Controller
@Hidden
public class ReactAppController {
    @RequestMapping(value = {"/", "/{x:[\\w\\-]+}", "/{x:^(?!api$).*$}/**/{y:[\\w\\-]+}"})
    public String getIndex() {
        return "forward:/index.html";
    }
}
