package com.huntly.server.connector.github;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.google.common.primitives.Ints;
import com.huntly.common.util.Base64Utils;
import com.huntly.common.util.UrlUtils;
import com.huntly.interfaces.external.model.CapturePage;
import com.huntly.interfaces.external.model.GithubRepoProperties;
import com.huntly.server.connector.ConnectorProperties;
import com.huntly.server.connector.InfoConnector;
import com.huntly.server.domain.constant.AppConstants;
import com.huntly.server.domain.exceptions.ConnectorFetchException;
import com.huntly.server.util.JSONUtils;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.util.CollectionUtils;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.ProxySelector;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * @author lcomplete
 */
@Slf4j
public class GithubConnector extends InfoConnector {
    ConnectorProperties properties;

    private final HttpClient client;

    public GithubConnector(ConnectorProperties properties) {
        this.properties = properties;
        this.client = buildHttpClient(properties);
    }

    public GithubConnector(ConnectorProperties properties, HttpClient client) {
        this.properties = properties;
        this.client = client;
    }

    public List<CapturePage> fetchAllPages() {
        var perPage = 100;
        var maxPage = 1000;
        List<CapturePage> pages = new ArrayList<>();
        for (int i = 1; i <= maxPage; i++) {
            var partPages = fetchPages(perPage, i);
            pages.addAll(partPages);
            if (CollectionUtils.isEmpty(partPages) || partPages.size() < perPage) {
                break;
            }
        }
        return pages;
    }

    public List<CapturePage> fetchNewestPages() {
        return fetchPages(AppConstants.GITHUB_DEFAULT_FETCH_PAGE_SIZE, 1);
    }

    public List<CapturePage> fetchPages(int perPage, int page) {
        HttpRequest request = HttpRequest.newBuilder().GET().uri(URI.create("https://api.github.com/user/starred?sort=created&direction=desc&per_page=" + perPage + "&page=" + page))
                .header("Accept", "application/vnd.github.v3.star+json")
                .header("Authorization", "Bearer " + properties.getApiToken()).build();
        List<CapturePage> pages = new ArrayList<>();
        try {
            HttpResponse<String> responseData = client.send(request, HttpResponse.BodyHandlers.ofString());
            var responseText = responseData.body();
            ObjectMapper objectMapper = new ObjectMapper();
            JsonNode rootNode = objectMapper.readTree(responseText);
            if (rootNode.isArray()) {
                for (int i = 0; i < rootNode.size(); i++) {
                    JsonNode starNode = rootNode.get(i);
                    JsonNode repoNode = starNode.get("repo");
                    String starredAt = starNode.get("starred_at").asText();
                    String fullName = repoNode.get("full_name").asText();
                    String htmlUrl = repoNode.get("html_url").asText();
                    String description = repoNode.get("description") != null ? repoNode.get("description").asText() : "";
                    String language = repoNode.get("language").asText();
                    String author = "";
                    if (repoNode.get("owner") != null && repoNode.get("owner").isObject()) {
                        author = repoNode.get("owner").get("login").asText();
                    }
                    var repoProperties = getGithubRepoProperties(repoNode);

                    CapturePage capturePage = new CapturePage();
                    capturePage.setUrl(htmlUrl);
                    //todo fix hash url in readme
                    capturePage.setBaseUrl("https://raw.githubusercontent.com/" + fullName + "/" + repoProperties.getDefaultBranch() + "/");
                    capturePage.setDomain(UrlUtils.getDomainName(htmlUrl));
                    capturePage.setDescription(description);
                    capturePage.setLanguage(language);
                    capturePage.setTitle(fullName);
                    capturePage.setAuthor(author);
                    capturePage.setConnectedAt(Instant.parse(starredAt));

                    //set properties
                    capturePage.setPageJsonProperties(JSONUtils.toJson(repoProperties));

                    pages.add(capturePage);
                }
            }
        } catch (JsonProcessingException e) {
            throw new ConnectorFetchException(e);
        } catch (IOException e) {
            throw new ConnectorFetchException(e);
        } catch (InterruptedException e) {
            throw new ConnectorFetchException(e);
        }

        return pages;
    }

    private GithubRepoProperties getGithubRepoProperties(JsonNode repoNode) {
        String nodeId = repoNode.get("node_id").asText();
        String name = repoNode.get("name").asText();
        String defaultBranch = repoNode.get("default_branch").asText();
        String homepage = repoNode.get("homepage").asText();
        Integer stargazersCount = Ints.tryParse(repoNode.get("stargazers_count").asText());
        Integer forksCount = Ints.tryParse(repoNode.get("forks_count").asText());
        Integer watchersCount = Ints.tryParse(repoNode.get("watchers_count").asText());
        List<String> topics = new ArrayList<>();
        if (repoNode.get("topics") != null && repoNode.get("topics").isArray()) {
            for (int j = 0; j < repoNode.get("topics").size(); j++) {
                topics.add(repoNode.get("topics").get(j).asText());
            }
        }
        Instant updatedAt = Instant.parse(repoNode.get("updated_at").asText());
        GithubRepoProperties repoProperties = new GithubRepoProperties();
        repoProperties.setNodeId(nodeId);
        repoProperties.setName(name);
        repoProperties.setDefaultBranch(defaultBranch);
        repoProperties.setStargazersCount(stargazersCount);
        repoProperties.setForksCount(forksCount);
        repoProperties.setWatchersCount(watchersCount);
        repoProperties.setTopics(topics);
        repoProperties.setUpdatedAt(updatedAt);
        repoProperties.setHomepage(homepage);
        return repoProperties;
    }

    public CapturePage fetchPageContent(CapturePage capturePage) {
        if (StringUtils.isBlank(capturePage.getContent())) {
            capturePage.setContent(fetchHTMLReadmeContent(capturePage.getTitle()));
        }
        return capturePage;
    }

    public String fetchHTMLReadmeContent(String fullName) {
        HttpRequest request = HttpRequest.newBuilder().GET().uri(URI.create("https://api.github.com/repos/" + fullName + "/readme"))
                .header("Accept", "application/vnd.github.v3.html")
                .header("Authorization", "Bearer " + properties.getApiToken()).build();
        try {
            HttpResponse<String> responseData = client.send(request, HttpResponse.BodyHandlers.ofString());
            return responseData.body();
        } catch (JsonProcessingException e) {
            throw new ConnectorFetchException(e);
        } catch (IOException | InterruptedException e) {
            throw new ConnectorFetchException(e);
        }
    }

    public String fetchJSONReadmeContent(String fullName) {
        HttpRequest request = HttpRequest.newBuilder().GET().uri(URI.create("https://api.github.com/repos/" + fullName + "/readme"))
                .header("Accept", "application/vnd.github+json")
                .header("Authorization", "Bearer " + properties.getApiToken()).build();
        try {
            HttpResponse<String> responseData = client.send(request, HttpResponse.BodyHandlers.ofString());
            var responseText = responseData.body();
            ObjectMapper objectMapper = new ObjectMapper();
            JsonNode readmeNode = objectMapper.readTree(responseText);
            if (readmeNode.has("content")) {
                String content = readmeNode.get("content").asText();
                if (log.isDebugEnabled()) {
                    log.debug("github readme content: " + content);
                }
                return decodeReadmeContent(content);
            }
        } catch (JsonProcessingException e) {
            throw new RuntimeException(e);
        } catch (IOException | InterruptedException e) {
            throw new RuntimeException(e);
        }
        return "";
    }

    public static String decodeReadmeContent(String content) {
        content = content.replace("\n", "");
        return Base64Utils.decode(content);
    }
}
