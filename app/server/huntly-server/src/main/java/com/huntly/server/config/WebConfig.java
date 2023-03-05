package com.huntly.server.config;

import com.huntly.jpa.repository.support.CustomJpaRepository;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

/**
 * @author lcomplete
 */
@Configuration
@EnableJpaRepositories(repositoryBaseClass = CustomJpaRepository.class, basePackages = {"com.huntly.server.repository"})
public class WebConfig {

}
