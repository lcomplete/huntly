package com.huntly.server.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import springfox.documentation.builders.ApiInfoBuilder;
import springfox.documentation.service.ApiInfo;
import springfox.documentation.spi.DocumentationType;
import springfox.documentation.spring.web.plugins.Docket;

@Configuration
public class DocketConfig {
    @Bean
    public Docket docket() {
        Docket docket = new Docket(DocumentationType.OAS_30)
                .forCodeGeneration(true)
                .apiInfo(apiInfo());
        return docket;
    }
    
    private ApiInfo apiInfo(){
        return new ApiInfoBuilder()
                .title("huntly api doc")
                .version("3.0")
                .description("huntly api doc for code generation")
                .build();
    }
}
