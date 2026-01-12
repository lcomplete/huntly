package com.huntly.server;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.scheduling.annotation.EnableAsync;

/**
 * @author lcomplete
 */
@SpringBootApplication
@EnableAsync
@EntityScan(basePackages = {"com.huntly.server.domain.entity"})
public class HuntlyServerApplication {
    public static void main(String[] args){
        SpringApplication.run(HuntlyServerApplication.class,args);
    }
}
