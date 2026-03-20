package com.huntly.server.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class DocketConfig {
    @Bean
    public OpenAPI huntlyOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("huntly api doc")
                        .version("3.0")
                        .description("huntly api doc for code generation"));
    }
}
