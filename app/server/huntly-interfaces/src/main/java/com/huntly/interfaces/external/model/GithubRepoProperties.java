package com.huntly.interfaces.external.model;

import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.util.List;

/**
 * @author lcomplete
 */
@Getter
@Setter
public class GithubRepoProperties {
    private String nodeId;
    
    private String name;
    
    private String defaultBranch;
    
    private Integer stargazersCount;
    
    private Integer forksCount;
    
    private Integer watchersCount;
    
    private String homepage;
    
    private List<String> topics;
    
    private Instant updatedAt;
}
