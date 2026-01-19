package com.huntly.server.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.huntly.interfaces.external.dto.HighlightListItem;
import com.huntly.interfaces.external.dto.LibraryExportInfo;
import com.huntly.interfaces.external.model.ContentType;
import com.huntly.interfaces.external.model.LibraryExportStatus;
import com.huntly.interfaces.external.model.TweetProperties;
import com.huntly.interfaces.external.query.HighlightListQuery;
import com.huntly.server.domain.constant.AppConstants;
import com.huntly.server.domain.entity.Page;
import com.huntly.server.domain.vo.CollectionGroupVO;
import com.huntly.server.domain.vo.CollectionTreeVO;
import com.huntly.server.domain.vo.CollectionVO;
import com.huntly.server.mcp.TweetTextParser;
import com.huntly.server.repository.PageRepository;
import com.huntly.server.util.HtmlUtils;
import com.huntly.server.util.MarkdownUtils;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.Executor;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * @author lcomplete
 */
@Slf4j
@Service
public class LibraryExportService {
    private static final int EXPORT_PAGE_SIZE = 100;
    private static final int EXPORT_HIGHLIGHT_PAGE_SIZE = 100;
    private static final int FILE_NAME_SNIPPET_MAX_LENGTH = 80;
    private static final int CONTENT_SNIPPET_MAX_LENGTH = 120;
    private static final DateTimeFormatter FILE_TIMESTAMP_FORMAT = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss")
            .withZone(ZoneOffset.UTC);
    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ISO_INSTANT;

    private final PageRepository pageRepository;
    private final PageHighlightService pageHighlightService;
    private final CollectionService collectionService;
    private final Executor taskExecutor;
    private final ObjectMapper objectMapper;
    private final AtomicReference<LibraryExportJob> currentJob = new AtomicReference<>();

    public LibraryExportService(PageRepository pageRepository,
                                PageHighlightService pageHighlightService,
                                CollectionService collectionService,
                                @Qualifier("serviceTaskExecutor") Executor taskExecutor) {
        this.pageRepository = pageRepository;
        this.pageHighlightService = pageHighlightService;
        this.collectionService = collectionService;
        this.taskExecutor = taskExecutor;
        this.objectMapper = new ObjectMapper()
                .registerModule(new JavaTimeModule())
                .configure(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS, false);
    }

    public synchronized LibraryExportInfo startExport() {
        LibraryExportJob existingJob = currentJob.get();
        if (existingJob != null && existingJob.status == LibraryExportStatus.IN_PROGRESS) {
            return toInfo(existingJob);
        }

        String fileName = "library-markdown-" + FILE_TIMESTAMP_FORMAT.format(Instant.now()) + ".zip";
        LibraryExportJob job = new LibraryExportJob(fileName, Instant.now());
        currentJob.set(job);

        Path cacheDir = getCacheDir();
        try {
            clearCache(cacheDir);
        } catch (IOException e) {
            job.status = LibraryExportStatus.FAILED;
            job.message = "Failed to prepare cache directory.";
            log.error("Failed to clear markdown cache", e);
            return toInfo(job);
        }

        taskExecutor.execute(() -> runExport(job));
        return toInfo(job);
    }

    public LibraryExportInfo getLatestExport() {
        LibraryExportJob job = currentJob.get();
        if (job != null && job.status == LibraryExportStatus.IN_PROGRESS) {
            return toInfo(job);
        }

        Optional<Path> latestZip = findLatestZip();
        if (latestZip.isPresent()) {
            return buildReadyInfo(latestZip.get());
        }

        if (job != null && job.status == LibraryExportStatus.FAILED) {
            return toInfo(job);
        }

        LibraryExportInfo info = new LibraryExportInfo();
        info.setStatus(LibraryExportStatus.EMPTY);
        return info;
    }

    public LibraryExportInfo getExportStatus(String fileName) {
        if (StringUtils.isBlank(fileName)) {
            return getLatestExport();
        }

        LibraryExportJob job = currentJob.get();
        if (job != null && Objects.equals(job.fileName, fileName)) {
            return toInfo(job);
        }

        Path zipPath = resolveZipPath(fileName);
        if (Files.exists(zipPath)) {
            return buildReadyInfo(zipPath);
        }

        LibraryExportInfo info = new LibraryExportInfo();
        info.setFileName(fileName);
        info.setStatus(LibraryExportStatus.MISSING);
        return info;
    }

    public Path resolveZipPath(String fileName) {
        if (StringUtils.containsAny(fileName, "/", "\\") || StringUtils.contains(fileName, "..")) {
            throw new IllegalArgumentException("Invalid file name.");
        }
        if (!fileName.endsWith(".zip")) {
            throw new IllegalArgumentException("Invalid file type.");
        }
        return getCacheDir().resolve(fileName);
    }

    private void runExport(LibraryExportJob job) {
        Path cacheDir = getCacheDir();
        Path exportDir = cacheDir.resolve(job.getExportDirName());
        Path zipPath = cacheDir.resolve(job.fileName);

        try {
            Files.createDirectories(exportDir);
            exportPages(exportDir);
            exportHighlights(exportDir);
            zipDirectory(exportDir, zipPath);

            job.status = LibraryExportStatus.READY;
            job.completedAt = Instant.now();
            job.sizeBytes = Files.size(zipPath);
            job.message = "Export ready.";

            clearCacheExcept(cacheDir, zipPath);
        } catch (Exception e) {
            job.status = LibraryExportStatus.FAILED;
            job.completedAt = Instant.now();
            job.message = StringUtils.defaultIfBlank(e.getMessage(), "Export failed.");
            log.error("Failed to export library markdown", e);
            try {
                Files.deleteIfExists(zipPath);
            } catch (IOException ioException) {
                log.warn("Failed to delete broken zip file", ioException);
            }
            try {
                clearCache(cacheDir);
            } catch (IOException ioException) {
                log.warn("Failed to clear markdown cache after export failure", ioException);
            }
        } finally {
            try {
                deleteRecursively(exportDir);
            } catch (IOException e) {
                log.warn("Failed to clean export directory", e);
            }
        }
    }

    private void exportPages(Path exportDir) throws IOException {
        CollectionTreeVO tree = collectionService.getTreeWithoutCounts();

        // Export unsorted pages
        Path unsortedDir = exportDir.resolve("Unsorted");
        exportUnsortedPages(unsortedDir);

        // Export pages by collection tree structure
        for (CollectionGroupVO group : tree.getGroups()) {
            String groupDirName = sanitizeFolderName(group.getName());
            Path groupDir = exportDir.resolve(groupDirName);

            for (CollectionVO collection : group.getCollections()) {
                exportCollectionRecursive(groupDir, collection);
            }
        }
    }

    private void exportUnsortedPages(Path unsortedDir) throws IOException {
        int pageIndex = 0;
        while (true) {
            List<Page> pages = pageRepository.findUnsortedLibraryPages(PageRequest.of(pageIndex, EXPORT_PAGE_SIZE));
            if (pages.isEmpty()) {
                break;
            }
            // Create directory only if there are pages
            if (pageIndex == 0) {
                Files.createDirectories(unsortedDir);
            }
            for (Page page : pages) {
                writePageMarkdown(unsortedDir, page);
            }
            if (pages.size() < EXPORT_PAGE_SIZE) {
                break;
            }
            pageIndex++;
        }
    }

    private void exportCollectionRecursive(Path parentDir, CollectionVO collection) throws IOException {
        String collectionDirName = sanitizeFolderName(collection.getName());
        Path collectionDir = parentDir.resolve(collectionDirName);

        // Export pages in this collection
        exportCollectionPages(collectionDir, collection.getId());

        // Recursively export child collections
        for (CollectionVO child : collection.getChildren()) {
            exportCollectionRecursive(collectionDir, child);
        }
    }

    private void exportCollectionPages(Path collectionDir, Long collectionId) throws IOException {
        int pageIndex = 0;
        while (true) {
            List<Page> pages = pageRepository.findByCollectionIdAndLibrarySaveStatusGreaterThanOrderBySavedAtDesc(
                    collectionId, 0, PageRequest.of(pageIndex, EXPORT_PAGE_SIZE));
            if (pages.isEmpty()) {
                break;
            }
            // Create directory only if there are pages
            if (pageIndex == 0) {
                Files.createDirectories(collectionDir);
            }
            for (Page page : pages) {
                writePageMarkdown(collectionDir, page);
            }
            if (pages.size() < EXPORT_PAGE_SIZE) {
                break;
            }
            pageIndex++;
        }
    }

    private String sanitizeFolderName(String name) {
        if (StringUtils.isBlank(name)) {
            return "Unnamed";
        }
        // Remove or replace characters that are problematic for file systems
        String sanitized = name.replaceAll("[\\\\/:*?\"<>|]", "_");
        sanitized = sanitized.trim();
        if (sanitized.isEmpty()) {
            return "Unnamed";
        }
        // Limit length
        if (sanitized.length() > 100) {
            sanitized = sanitized.substring(0, 100).trim();
        }
        return sanitized;
    }

    private void exportHighlights(Path exportDir) throws IOException {
        Path highlightsDir = exportDir.resolve("highlights");
        Files.createDirectories(highlightsDir);

        int pageIndex = 0;
        while (true) {
            HighlightListQuery query = new HighlightListQuery();
            query.setPage(pageIndex);
            query.setSize(EXPORT_HIGHLIGHT_PAGE_SIZE);
            query.setDirection("desc");
            org.springframework.data.domain.Page<HighlightListItem> page = pageHighlightService.getHighlightList(query);
            if (page == null || page.getContent().isEmpty()) {
                break;
            }
            for (HighlightListItem highlight : page.getContent()) {
                writeHighlightMarkdown(highlightsDir, highlight);
            }
            if (!page.hasNext()) {
                break;
            }
            pageIndex++;
        }
    }

    private void writePageMarkdown(Path categoryDir, Page page) throws IOException {
        String title = resolveTitle(page.getTitle(), extractContentSnippet(page.getContent()));
        String fileName = buildFileName(page.getId(), title);
        String markdownBody = buildPageMarkdown(page);
        Map<String, Object> frontmatter = buildPageFrontmatter(page, title);
        writeMarkdownFile(categoryDir.resolve(fileName), frontmatter, markdownBody);
    }

    private void writeHighlightMarkdown(Path highlightsDir, HighlightListItem highlight) throws IOException {
        String title = resolveTitle(highlight.getPageTitle(), highlight.getHighlightedText());
        String fileName = buildFileName(highlight.getId(), title);

        Map<String, Object> frontmatter = new LinkedHashMap<>();
        frontmatter.put("id", highlight.getId());
        frontmatter.put("pageId", highlight.getPageId());
        frontmatter.put("title", highlight.getPageTitle());
        frontmatter.put("url", highlight.getPageUrl());
        frontmatter.put("createdAt", highlight.getCreatedAt());

        String body = buildHighlightBody(highlight);
        writeMarkdownFile(highlightsDir.resolve(fileName), frontmatter, body);
    }

    private String buildHighlightBody(HighlightListItem highlight) {
        StringBuilder body = new StringBuilder();
        if (StringUtils.isNotBlank(highlight.getHighlightedText())) {
            String quoted = Stream.of(highlight.getHighlightedText().split("\\R"))
                    .map(line -> "> " + line)
                    .collect(Collectors.joining("\n"));
            body.append(quoted).append("\n\n");
        }
        if (StringUtils.isNotBlank(highlight.getPageUrl())) {
            String label = StringUtils.defaultIfBlank(highlight.getPageTitle(), "Source");
            body.append("[").append(label).append("](").append(highlight.getPageUrl()).append(")\n");
        }
        return body.toString();
    }

    private Map<String, Object> buildPageFrontmatter(Page page, String title) {
        Map<String, Object> frontmatter = new LinkedHashMap<>();
        boolean isTweet = isTweetType(page);

        frontmatter.put("id", page.getId());
        // Tweet doesn't need title field
        if (!isTweet) {
            frontmatter.put("title", title);
        }
        frontmatter.put("url", page.getUrl());
        frontmatter.put("contentType", resolveContentType(page.getContentType()));

        // Status fields with corresponding time fields (only include time if status is set)
        if (Boolean.TRUE.equals(page.getStarred())) {
            frontmatter.put("starred", true);
            frontmatter.put("starredAt", page.getStarredAt());
        }
        if (Boolean.TRUE.equals(page.getReadLater())) {
            frontmatter.put("readLater", true);
            frontmatter.put("readLaterAt", page.getReadLaterAt());
        }
        if (Boolean.TRUE.equals(page.getMarkRead())) {
            frontmatter.put("markRead", true);
        }
        // Library save status: 1=saved, 2=archived
        if (page.getLibrarySaveStatus() != null && page.getLibrarySaveStatus() > 0) {
            frontmatter.put("savedAt", page.getSavedAt());
            if (page.getLibrarySaveStatus() == 2) {
                frontmatter.put("archived", true);
                frontmatter.put("archivedAt", page.getArchivedAt());
            }
        }

        // Common time fields
        frontmatter.put("createdAt", page.getCreatedAt());
        frontmatter.put("connectedAt", page.getConnectedAt());

        // Tweet-specific fields
        if (isTweet) {
            TweetProperties tweetProps = parseTweetProperties(page.getPageJsonProperties());
            if (tweetProps != null) {
                TweetProperties mainTweet = tweetProps.getRetweetedTweet() != null ? tweetProps.getRetweetedTweet() : tweetProps;
                frontmatter.put("author", mainTweet.getUserName());
                frontmatter.put("authorScreenName", mainTweet.getUserScreeName());
                frontmatter.put("likes", mainTweet.getFavoriteCount());
                frontmatter.put("views", mainTweet.getViewCount());
                frontmatter.put("comments", mainTweet.getReplyCount());
                frontmatter.put("retweets", mainTweet.getRetweetCount());
                frontmatter.put("quotes", mainTweet.getQuoteCount());
                frontmatter.put("tweetId", mainTweet.getTweetIdStr());
                frontmatter.put("tweetCreatedAt", mainTweet.getCreatedAt());
                frontmatter.put("url", mainTweet.getUrl());
            }
        } else {
            frontmatter.put("author", page.getAuthor());
        }

        return frontmatter;
    }

    private String buildPageMarkdown(Page page) {
        if (page == null) {
            return "";
        }

        if (isTweetType(page)) {
            // Use TweetTextParser to extract plain text content (same as MCP tools)
            String tweetText = TweetTextParser.extractPlainText(page.getPageJsonProperties());
            if (StringUtils.isNotBlank(tweetText)) {
                return tweetText;
            }
            // Fallback: try to render from TweetProperties if extractPlainText fails
            TweetProperties tweetProps = parseTweetProperties(page.getPageJsonProperties());
            String tweetHtml = renderTweetHtml(tweetProps);
            return MarkdownUtils.htmlToMarkdown(tweetHtml);
        }

        if (StringUtils.isBlank(page.getContent())) {
            return "";
        }

        if (Objects.equals(page.getContentType(), ContentType.MARKDOWN.getCode())) {
            return page.getContent();
        }

        String html = page.getContent();
        if (StringUtils.isNotBlank(page.getUrl())) {
            html = HtmlUtils.clean(html, page.getUrl()).getHtml();
        }
        return MarkdownUtils.htmlToMarkdown(html);
    }

    private boolean isTweetType(Page page) {
        if (page == null || page.getContentType() == null) {
            return false;
        }
        return Objects.equals(page.getContentType(), ContentType.TWEET.getCode())
                || Objects.equals(page.getContentType(), ContentType.QUOTED_TWEET.getCode());
    }

    private TweetProperties parseTweetProperties(String json) {
        if (StringUtils.isBlank(json)) {
            return null;
        }
        try {
            return objectMapper.readValue(json, TweetProperties.class);
        } catch (IOException e) {
            log.warn("Failed to parse tweet properties", e);
            return null;
        }
    }

    private String renderTweetHtml(TweetProperties tweetProps) {
        if (tweetProps == null) {
            return "";
        }

        StringBuilder html = new StringBuilder();
        TweetProperties mainTweet = tweetProps.getRetweetedTweet() != null ? tweetProps.getRetweetedTweet() : tweetProps;
        if (tweetProps.getRetweetedTweet() != null) {
            html.append("<p>Retweeted by ");
            html.append("<a href=\"").append(tweetProps.getUrl()).append("\">");
            html.append(StringUtils.defaultString(tweetProps.getUserName(), "Unknown"));
            html.append("</a>");
            html.append("</p>");
        }
        html.append(renderTweetBody(mainTweet));
        return html.toString();
    }

    private String renderTweetBody(TweetProperties tweetProps) {
        if (tweetProps == null) {
            return "";
        }

        List<Integer> displayRange = tweetProps.getDisplayTextRange();
        if (Boolean.TRUE.equals(tweetProps.getNoteTweet())) {
            int length = StringUtils.defaultString(tweetProps.getFullText()).codePointCount(0, StringUtils.defaultString(tweetProps.getFullText()).length());
            displayRange = List.of(0, length);
        }

        StringBuilder html = new StringBuilder();
        html.append("<div>");
        html.append("<p><strong>");
        html.append("<a href=\"https://twitter.com/").append(StringUtils.defaultString(tweetProps.getUserScreeName(), "")).append("\">");
        html.append(StringUtils.defaultString(tweetProps.getUserName(), "Unknown"));
        html.append("</a></strong> ");
        html.append("<a href=\"https://twitter.com/").append(StringUtils.defaultString(tweetProps.getUserScreeName(), "")).append("\">");
        html.append("@").append(StringUtils.defaultString(tweetProps.getUserScreeName(), ""));
        html.append("</a>");
        if (StringUtils.isNotBlank(tweetProps.getUrl())) {
            html.append(" · <a href=\"").append(tweetProps.getUrl()).append("\">");
            html.append(formatInstant(tweetProps.getCreatedAt()));
            html.append("</a>");
        }
        html.append("</p>");

        ReplyMentions replyMentions = extractReplyMentions(tweetProps.getUserMentions());
        if (!replyMentions.replyMentions.isEmpty()) {
            html.append("<p>Replying to ");
            for (int i = 0; i < replyMentions.replyMentions.size(); i++) {
                TweetProperties.UserMention mention = replyMentions.replyMentions.get(i);
                html.append("<a href=\"https://twitter.com/").append(mention.getScreenName()).append("\">@");
                html.append(mention.getScreenName()).append("</a>");
                if (i < replyMentions.replyMentions.size() - 1) {
                    html.append(" ");
                }
            }
            html.append("</p>");
        }

        String renderText = buildTweetRenderText(tweetProps, replyMentions.remainingMentions, displayRange);
        renderText = renderText.replace("\n", "<br/>");
        html.append("<p>").append(renderText).append("</p>");

        List<TweetProperties.Media> medias = tweetProps.getMedias();
        if (medias != null && !medias.isEmpty()) {
            List<TweetProperties.Media> videos = medias.stream()
                    .filter(media -> "video".equalsIgnoreCase(media.getType()))
                    .collect(Collectors.toList());
            if (videos.isEmpty()) {
                for (TweetProperties.Media media : medias) {
                    html.append("<p><img src=\"").append(media.getMediaUrl()).append("\" alt=\"\"/></p>");
                }
            } else {
                TweetProperties.Media video = videos.get(0);
                Optional<TweetProperties.Variant> maxVariant = findMaxBitrate(video);
                Optional<TweetProperties.Variant> normalVariant = findNormalBitrate(video);
                html.append("<p>");
                if (normalVariant.isPresent()) {
                    html.append("<a href=\"").append(normalVariant.get().getUrl()).append("\">Video</a>");
                }
                if (maxVariant.isPresent() && (!normalVariant.isPresent() || !Objects.equals(normalVariant.get().getUrl(), maxVariant.get().getUrl()))) {
                    html.append(" (<a href=\"").append(maxVariant.get().getUrl()).append("\">HD</a>)");
                }
                html.append("</p>");
                if (StringUtils.isNotBlank(video.getMediaUrl())) {
                    html.append("<p><img src=\"").append(video.getMediaUrl()).append("\" alt=\"\"/></p>");
                }
            }
        }

        TweetProperties.Card card = tweetProps.getCard();
        if (card != null && StringUtils.isNotBlank(card.getUrl())) {
            html.append("<p><a href=\"").append(card.getUrl()).append("\">");
            if (StringUtils.isNotBlank(card.getImageUrl())) {
                html.append("<img src=\"").append(card.getImageUrl()).append("\" alt=\"\"/>");
            } else if (StringUtils.isNotBlank(card.getThumbnailImageUrl())) {
                html.append("<img src=\"").append(card.getThumbnailImageUrl()).append("\" alt=\"\"/>");
            }
            if (StringUtils.isNotBlank(card.getTitle())) {
                html.append("<br/><strong>").append(card.getTitle()).append("</strong>");
            }
            if (StringUtils.isNotBlank(card.getDescription())) {
                html.append("<br/>").append(card.getDescription());
            }
            if (StringUtils.isNotBlank(card.getDomain())) {
                html.append("<br/>").append(card.getDomain());
            }
            html.append("</a></p>");
        }

        if (tweetProps.getQuotedTweet() != null) {
            html.append("<blockquote>");
            html.append(renderTweetBody(tweetProps.getQuotedTweet()));
            html.append("</blockquote>");
        }

        html.append("</div>");
        return html.toString();
    }

    private Optional<TweetProperties.Variant> findMaxBitrate(TweetProperties.Media media) {
        if (media == null || media.getVideoInfo() == null || media.getVideoInfo().getVariants() == null) {
            return Optional.empty();
        }
        return media.getVideoInfo().getVariants().stream()
                .filter(variant -> variant.getBitrate() != null)
                .max(Comparator.comparingInt(TweetProperties.Variant::getBitrate));
    }

    private Optional<TweetProperties.Variant> findNormalBitrate(TweetProperties.Media media) {
        if (media == null || media.getVideoInfo() == null || media.getVideoInfo().getVariants() == null) {
            return Optional.empty();
        }
        return media.getVideoInfo().getVariants().stream()
                .filter(variant -> variant.getBitrate() != null && variant.getBitrate() < 1_000_000)
                .max(Comparator.comparingInt(TweetProperties.Variant::getBitrate));
    }

    private String buildTweetRenderText(TweetProperties tweetProps, List<TweetProperties.UserMention> userMentions, List<Integer> displayRange) {
        String fullText = StringUtils.defaultString(tweetProps.getFullText());
        List<String> fullTextArr = new ArrayList<>();
        fullText.codePoints().forEach(cp -> fullTextArr.add(new String(Character.toChars(cp))));

        Map<Integer, IndexReplacement> indexMap = new LinkedHashMap<>();
        if (tweetProps.getHashtags() != null) {
            tweetProps.getHashtags().forEach(hashtag -> {
                if (hashtag.getIndices() != null && hashtag.getIndices().size() == 2) {
                    indexMap.put(hashtag.getIndices().get(0),
                            new IndexReplacement(hashtag.getIndices().get(1),
                                    "<a href=\"https://twitter.com/hashtag/" + hashtag.getText() + "\">#" + hashtag.getText() + "</a>"));
                }
            });
        }
        if (tweetProps.getUrls() != null) {
            tweetProps.getUrls().forEach(url -> {
                if (url.getIndices() != null && url.getIndices().size() == 2) {
                    indexMap.put(url.getIndices().get(0),
                            new IndexReplacement(url.getIndices().get(1),
                                    "<a href=\"" + url.getExpandedUrl() + "\">" + url.getDisplayUrl() + "</a>"));
                }
            });
        }
        if (tweetProps.getMedias() != null) {
            tweetProps.getMedias().forEach(media -> {
                if ("video".equalsIgnoreCase(media.getType()) && media.getIndices() != null && media.getIndices().size() == 2) {
                    indexMap.put(media.getIndices().get(0), new IndexReplacement(media.getIndices().get(1), ""));
                }
            });
        }
        if (userMentions != null) {
            userMentions.forEach(mention -> {
                if (mention.getIndices() != null && mention.getIndices().size() == 2) {
                    indexMap.put(mention.getIndices().get(0),
                            new IndexReplacement(mention.getIndices().get(1),
                                    "<a href=\"https://twitter.com/" + mention.getScreenName() + "\">@" + mention.getScreenName() + "</a>"));
                }
            });
        }

        StringBuilder renderText = new StringBuilder();
        int lastIndex = 0;
        int index = 0;
        int length = fullTextArr.size();
        for (index = 0; index < length; index++) {
            if (displayRange != null && displayRange.size() == 2 && index < displayRange.get(0)) {
                lastIndex = index + 1;
                continue;
            }
            IndexReplacement replacement = indexMap.get(index);
            if (replacement != null) {
                if (index > lastIndex) {
                    renderText.append(String.join("", fullTextArr.subList(lastIndex, index)));
                }
                renderText.append(replacement.html);
                index = replacement.endIndex - 1;
                lastIndex = replacement.endIndex;
            }
        }
        if (index > lastIndex) {
            int endIndex = length;
            if (displayRange != null && displayRange.size() == 2) {
                endIndex = Math.min(displayRange.get(1), length);
            }
            renderText.append(String.join("", fullTextArr.subList(lastIndex, endIndex)));
        }
        return renderText.toString();
    }

    private ReplyMentions extractReplyMentions(List<TweetProperties.UserMention> mentions) {
        ReplyMentions replyMentions = new ReplyMentions();
        if (mentions == null || mentions.isEmpty()) {
            return replyMentions;
        }
        int mentionIndexStart = 0;
        for (TweetProperties.UserMention mention : mentions) {
            if (mention.getIndices() != null && mention.getIndices().size() == 2
                    && mention.getIndices().get(0) == mentionIndexStart) {
                replyMentions.replyMentions.add(mention);
                mentionIndexStart = mention.getIndices().get(1) + 1;
            }
        }
        if (!replyMentions.replyMentions.isEmpty()) {
            replyMentions.remainingMentions = mentions.stream()
                    .filter(mention -> !replyMentions.replyMentions.contains(mention))
                    .collect(Collectors.toList());
        } else {
            replyMentions.remainingMentions = new ArrayList<>(mentions);
        }
        return replyMentions;
    }

    private String resolveTitle(String... options) {
        for (String option : options) {
            if (StringUtils.isNotBlank(option)) {
                return option.trim();
            }
        }
        return "Untitled";
    }

    private String extractContentSnippet(String content) {
        if (StringUtils.isBlank(content)) {
            return "";
        }
        String text = HtmlUtils.getDocText(content);
        text = text.replaceAll("\\s+", " ").trim();
        if (text.length() <= CONTENT_SNIPPET_MAX_LENGTH) {
            return text;
        }
        return text.substring(0, CONTENT_SNIPPET_MAX_LENGTH);
    }

    private String buildFileName(Long id, String title) {
        String safeTitle = sanitizeFileSegment(title);
        if (StringUtils.isBlank(safeTitle)) {
            safeTitle = "untitled";
        }
        return id + "-" + safeTitle + ".md";
    }

    private String sanitizeFileSegment(String value) {
        if (StringUtils.isBlank(value)) {
            return "";
        }
        // Build a clean filename by filtering out problematic characters
        StringBuilder result = new StringBuilder();
        for (int i = 0; i < value.length(); i++) {
            int codePoint = value.codePointAt(i);

            // Skip emoji and other symbols (they cause file system issues)
            if (codePoint > 0xFFFF) {
                // Surrogate pair (emoji, rare characters)
                i++; // Skip the low surrogate
                continue;
            }

            char ch = (char) codePoint;

            // Skip control characters
            if (Character.isISOControl(ch)) {
                continue;
            }

            // Skip file system reserved characters
            if (ch == '\\' || ch == '/' || ch == ':' || ch == '*' ||
                ch == '?' || ch == '"' || ch == '<' || ch == '>' || ch == '|') {
                result.append(' ');
                continue;
            }

            // Keep safe characters: letters, digits, spaces, basic punctuation, CJK characters
            if (Character.isLetterOrDigit(ch) ||
                Character.isSpaceChar(ch) || ch == ' ' ||
                ch == '-' || ch == '_' || ch == '.' || ch == ',' ||
                (ch >= 0x4E00 && ch <= 0x9FFF) ||  // CJK Unified Ideographs
                (ch >= 0x3400 && ch <= 0x4DBF) ||  // CJK Extension A
                (ch >= 0x3040 && ch <= 0x309F) ||  // Hiragana
                (ch >= 0x30A0 && ch <= 0x30FF) ||  // Katakana
                (ch >= 0xAC00 && ch <= 0xD7AF)) {  // Hangul
                result.append(ch);
            } else {
                // Replace other special characters with space
                result.append(' ');
            }
        }

        String sanitized = result.toString();
        sanitized = sanitized.replaceAll("\\s+", " ").trim();
        sanitized = sanitized.replaceAll("[. ]+$", "");

        if (sanitized.length() > FILE_NAME_SNIPPET_MAX_LENGTH) {
            sanitized = sanitized.substring(0, FILE_NAME_SNIPPET_MAX_LENGTH).trim();
        }

        return sanitized;
    }

    private String resolveContentType(Integer contentTypeCode) {
        if (contentTypeCode == null) {
            return null;
        }
        for (ContentType type : ContentType.values()) {
            if (Objects.equals(type.getCode(), contentTypeCode)) {
                return type.name();
            }
        }
        return contentTypeCode.toString();
    }

    private void writeMarkdownFile(Path path, Map<String, Object> frontmatter, String body) throws IOException {
        StringBuilder content = new StringBuilder();
        content.append("---\n");
        for (Map.Entry<String, Object> entry : frontmatter.entrySet()) {
            if (entry.getValue() == null) {
                continue;
            }
            content.append(entry.getKey()).append(": ").append(formatYamlValue(entry.getValue())).append("\n");
        }
        content.append("---\n\n");
        if (StringUtils.isNotBlank(body)) {
            content.append(body);
            if (!body.endsWith("\n")) {
                content.append("\n");
            }
        }
        // Clean the content to remove unmappable characters
        String cleanContent = sanitizeForUtf8(content.toString());
        Files.writeString(path, cleanContent, StandardCharsets.UTF_8);
    }

    private String formatYamlValue(Object value) {
        if (value instanceof Number || value instanceof Boolean) {
            return value.toString();
        }
        if (value instanceof Instant) {
            return "\"" + TIME_FORMATTER.format((Instant) value) + "\"";
        }
        String text = value.toString().replace("\\", "\\\\").replace("\"", "\\\"");
        text = text.replace("\n", "\\n");
        return "\"" + text + "\"";
    }

    private void zipDirectory(Path sourceDir, Path zipPath) throws IOException {
        try (OutputStream outputStream = Files.newOutputStream(zipPath);
             ZipOutputStream zipOutputStream = new ZipOutputStream(outputStream)) {
            try (Stream<Path> stream = Files.walk(sourceDir)) {
                List<Path> paths = stream.collect(Collectors.toList());
                for (Path path : paths) {
                    String entryName = sourceDir.relativize(path).toString().replace("\\", "/");
                    if (entryName.isEmpty()) {
                        continue;
                    }
                    if (Files.isDirectory(path)) {
                        if (!entryName.endsWith("/")) {
                            entryName = entryName + "/";
                        }
                        zipOutputStream.putNextEntry(new ZipEntry(entryName));
                        zipOutputStream.closeEntry();
                        continue;
                    }
                    ZipEntry entry = new ZipEntry(entryName);
                    zipOutputStream.putNextEntry(entry);
                    Files.copy(path, zipOutputStream);
                    zipOutputStream.closeEntry();
                }
            }
        }
    }

    private Path getCacheDir() {
        return Paths.get(AppConstants.MARKDOWN_CACHE_DIR);
    }

    private void clearCache(Path cacheDir) throws IOException {
        if (Files.notExists(cacheDir)) {
            Files.createDirectories(cacheDir);
            return;
        }
        try (Stream<Path> paths = Files.list(cacheDir)) {
            for (Path path : paths.collect(Collectors.toList())) {
                deleteRecursively(path);
            }
        }
    }

    private void clearCacheExcept(Path cacheDir, Path keepFile) throws IOException {
        if (Files.notExists(cacheDir)) {
            return;
        }
        try (Stream<Path> paths = Files.list(cacheDir)) {
            for (Path path : paths.collect(Collectors.toList())) {
                if (keepFile != null && keepFile.equals(path)) {
                    continue;
                }
                deleteRecursively(path);
            }
        }
    }

    private void deleteRecursively(Path path) throws IOException {
        if (path == null || Files.notExists(path)) {
            return;
        }
        if (Files.isDirectory(path)) {
            try (Stream<Path> walk = Files.walk(path)) {
                for (Path entry : walk.sorted(Comparator.reverseOrder()).collect(Collectors.toList())) {
                    Files.deleteIfExists(entry);
                }
            }
        } else {
            Files.deleteIfExists(path);
        }
    }

    private Optional<Path> findLatestZip() {
        Path cacheDir = getCacheDir();
        if (Files.notExists(cacheDir)) {
            return Optional.empty();
        }
        try (Stream<Path> paths = Files.list(cacheDir)) {
            return paths
                    .filter(path -> path.getFileName().toString().endsWith(".zip"))
                    .max(Comparator.comparingLong(path -> path.toFile().lastModified()));
        } catch (IOException e) {
            log.warn("Failed to list markdown cache", e);
            return Optional.empty();
        }
    }

    private LibraryExportInfo buildReadyInfo(Path zipPath) {
        LibraryExportInfo info = new LibraryExportInfo();
        info.setFileName(zipPath.getFileName().toString());
        info.setStatus(LibraryExportStatus.READY);
        info.setCompletedAt(Instant.ofEpochMilli(zipPath.toFile().lastModified()));
        info.setSizeBytes(zipPath.toFile().length());
        info.setMessage("Export ready.");
        return info;
    }

    private LibraryExportInfo toInfo(LibraryExportJob job) {
        LibraryExportInfo info = new LibraryExportInfo();
        info.setFileName(job.fileName);
        info.setStatus(job.status);
        info.setStartedAt(job.startedAt);
        info.setCompletedAt(job.completedAt);
        info.setSizeBytes(job.sizeBytes);
        info.setMessage(job.message);
        return info;
    }

    private static class LibraryExportJob {
        private final String fileName;
        private final Instant startedAt;
        private volatile Instant completedAt;
        private volatile Long sizeBytes;
        private volatile String message;
        private volatile LibraryExportStatus status = LibraryExportStatus.IN_PROGRESS;

        private LibraryExportJob(String fileName, Instant startedAt) {
            this.fileName = fileName;
            this.startedAt = startedAt;
        }

        private String getExportDirName() {
            if (fileName.endsWith(".zip")) {
                return fileName.substring(0, fileName.length() - 4);
            }
            return fileName;
        }
    }

    private static class IndexReplacement {
        private final int endIndex;
        private final String html;

        private IndexReplacement(int endIndex, String html) {
            this.endIndex = endIndex;
            this.html = html;
        }
    }

    private static class ReplyMentions {
        private final List<TweetProperties.UserMention> replyMentions = new ArrayList<>();
        private List<TweetProperties.UserMention> remainingMentions = new ArrayList<>();
    }

    private String formatInstant(Instant instant) {
        if (instant == null) {
            return "";
        }
        return TIME_FORMATTER.withLocale(Locale.US).format(instant);
    }

    private String sanitizeForUtf8(String value) {
        if (StringUtils.isBlank(value)) {
            return "";
        }
        // Remove invalid UTF-8 characters including unpaired surrogates
        StringBuilder result = new StringBuilder(value.length());
        for (int i = 0; i < value.length(); i++) {
            char ch = value.charAt(i);
            // Check if it's a high surrogate
            if (Character.isHighSurrogate(ch)) {
                // Make sure there's a valid low surrogate following it
                if (i + 1 < value.length() && Character.isLowSurrogate(value.charAt(i + 1))) {
                    // Valid surrogate pair
                    result.append(ch);
                    result.append(value.charAt(i + 1));
                    i++; // Skip the low surrogate
                }
                // Otherwise skip this invalid high surrogate
            } else if (Character.isLowSurrogate(ch)) {
                // Unpaired low surrogate, skip it
            } else {
                // Regular character
                result.append(ch);
            }
        }
        return result.toString();
    }
}
