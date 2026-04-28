package com.huntly.server.service;

import com.huntly.interfaces.external.dto.PageItem;
import com.huntly.interfaces.external.dto.PageSearchResult;
import com.huntly.interfaces.external.model.ContentType;
import com.huntly.interfaces.external.model.LibrarySaveStatus;
import com.huntly.interfaces.external.model.SearchOption;
import com.huntly.interfaces.external.query.SearchQuery;
import com.huntly.server.config.HuntlyProperties;
import com.huntly.server.connector.ConnectorType;
import com.huntly.server.domain.constant.AppConstants;
import com.huntly.server.domain.constant.DocFields;
import com.huntly.server.domain.entity.Page;
import com.huntly.server.repository.CollectionRepository;
import com.huntly.server.repository.PageRepository;
import com.huntly.server.util.HtmlUtils;
import com.huntly.server.util.PageSizeUtils;
import lombok.Getter;
import lombok.NonNull;
import lombok.Setter;
import lombok.experimental.Accessors;
import org.apache.commons.lang3.ObjectUtils;
import org.apache.commons.lang3.StringUtils;
import org.apache.lucene.analysis.Analyzer;
import org.apache.lucene.document.*;
import org.apache.lucene.index.DirectoryReader;
import org.apache.lucene.index.IndexWriter;
import org.apache.lucene.index.IndexWriterConfig;
import org.apache.lucene.index.Term;
import org.apache.lucene.search.*;
import org.apache.lucene.store.Directory;
import org.apache.lucene.store.FSDirectory;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StopWatch;
import org.wltea.analyzer.core.IKSegmenter;
import org.wltea.analyzer.core.Lexeme;
import org.wltea.analyzer.lucene.IKAnalyzer;

import java.io.File;
import java.io.IOException;
import java.io.StringReader;
import java.nio.file.Paths;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

/**
 * @author lcomplete
 */
@Service
public class LuceneService implements DisposableBean {

    private final String indexDirPath;

    private final PageRepository pageRepository;

    private final PageListService pageListService;

    private final CollectionRepository collectionRepository;

    private IndexWriter writer;

    public LuceneService(PageRepository pageRepository, PageListService pageListService, 
                         HuntlyProperties huntlyProperties, CollectionRepository collectionRepository) {
        this.pageListService = pageListService;
        indexDirPath = ObjectUtils.defaultIfNull(huntlyProperties.getLuceneDir(), AppConstants.DEFAULT_LUCENE_DIR);
        this.pageRepository = pageRepository;
        this.collectionRepository = collectionRepository;
    }

    @Override
    public void destroy() throws Exception {
        if (writer != null) {
            writer.close();
        }
    }

    public void indexAllPages() {
        ensureCreateDirectory();
        indexPages();
    }

    private void ensureCreateDirectory() {
        File directory = new File(indexDirPath);
        if (!directory.exists()) {
            directory.mkdirs();
        }
    }

    public Directory getDirectory() {
        ensureCreateDirectory();
        try {
            return FSDirectory.open(Paths.get(indexDirPath));
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }

    private synchronized void ensureLuceneIndexWriter() {
        if (writer == null) {
            Directory dir = getDirectory();
            Analyzer analyzer = new IKAnalyzer();
            IndexWriterConfig writerConfig = new IndexWriterConfig(analyzer);
            writerConfig.setOpenMode(IndexWriterConfig.OpenMode.CREATE_OR_APPEND);
            try {
                writer = new IndexWriter(dir, writerConfig);
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
        }
    }

    private void indexPages() {
        List<Page> pages = pageRepository.findAll();
        for (var page : pages) {
            indexPage(page);
        }
    }

    public synchronized void indexPage(Page page) {
        ensureLuceneIndexWriter();
        try {
            boolean docExists = false;
            Directory dir = getDirectory();
            if (DirectoryReader.indexExists(dir)) {
                try (DirectoryReader reader = DirectoryReader.open(dir)) {
                    IndexSearcher searcher = new IndexSearcher(reader);
                    Query idQuery = new TermQuery(new Term("id", page.getId().toString()));
                    TopDocs docs = searcher.search(idQuery, 1);
                    docExists = docs.totalHits.value > 0;
                }
            }
            Document doc = pageToDocument(page);
            if (docExists) {
                writer.updateDocument(new Term("id", page.getId().toString()), doc);
            } else {
                writer.addDocument(doc);
            }
            writer.commit();
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }

    private Document pageToDocument(Page page) {
        Document doc = new Document();
        doc.add(new StringField(DocFields.ID, page.getId().toString(), Field.Store.YES));
        if (StringUtils.isNotBlank(page.getTitle())) {
            doc.add(new TextField(DocFields.TITLE, page.getTitle(), Field.Store.YES));
        }
        if (StringUtils.isNotBlank(page.getDescription())) {
            doc.add(new TextField(DocFields.DESCRIPTION, page.getDescription(), Field.Store.YES));
        }
        if (StringUtils.isNotBlank(page.getContentText())) {
            doc.add(new TextField(DocFields.CONTENT, page.getContentText(), Field.Store.YES));
        } else if (StringUtils.isNotBlank(page.getContent())) {
            doc.add(new TextField(DocFields.CONTENT, HtmlUtils.getDocText(page.getContent()), Field.Store.YES));
        }
        if (StringUtils.isNotBlank(page.getAuthor())) {
            doc.add(new TextField(DocFields.AUTHOR, page.getAuthor(), Field.Store.YES));
        }
        if (StringUtils.isNotBlank(page.getUrl())) {
            doc.add(new TextField(DocFields.URL_TEXT, page.getUrl(), Field.Store.YES));
        }
        if (StringUtils.isNotBlank(page.getThumbUrl())) {
            doc.add(new StoredField(DocFields.THUMB_URL, page.getThumbUrl()));
        }
        if (page.getSourceId() != null) {
            doc.add(new IntPoint(DocFields.SOURCE_ID, page.getSourceId()));
            doc.add(new StoredField(DocFields.SOURCE_ID, page.getSourceId()));
        }
        if (page.getConnectorId() != null) {
            doc.add(new IntPoint(DocFields.CONNECTOR_ID, page.getConnectorId()));
            doc.add(new StoredField(DocFields.CONNECTOR_ID, page.getConnectorId()));
        }
        if (page.getConnectorType() != null) {
            doc.add(new IntPoint(DocFields.CONNECTOR_TYPE, page.getConnectorType()));
            doc.add(new StoredField(DocFields.CONNECTOR_TYPE, page.getConnectorType()));
        }
        if (page.getContentType() != null) {
            doc.add(new IntPoint(DocFields.CONTENT_TYPE, page.getContentType()));
            doc.add(new StoredField(DocFields.CONTENT_TYPE, page.getContentType()));
        }
        if (page.getFolderId() != null) {
            doc.add(new IntPoint(DocFields.FOLDER_ID, page.getFolderId()));
            doc.add(new StoredField(DocFields.FOLDER_ID, page.getFolderId()));
        }
        if (page.getCreatedAt() != null) {
            doc.add(new LongPoint(DocFields.CREATED_AT, page.getCreatedAt().getEpochSecond()));
            doc.add(new StoredField(DocFields.CREATED_AT, page.getCreatedAt().getEpochSecond()));
        }
        if (page.getLastReadAt() != null) {
            doc.add(new LongPoint(DocFields.LAST_READ_AT, page.getLastReadAt().getEpochSecond()));
            doc.add(new StoredField(DocFields.LAST_READ_AT, page.getLastReadAt().getEpochSecond()));
        }
        if (page.getLibrarySaveStatus() != null) {
            doc.add(new IntPoint(DocFields.LIBRARY_SAVE_STATUS, page.getLibrarySaveStatus()));
            doc.add(new StoredField(DocFields.LIBRARY_SAVE_STATUS, page.getLibrarySaveStatus()));
        }
        if (page.getStarred() != null && page.getStarred()) {
            doc.add(new StringField(DocFields.STARRED, "1", Field.Store.YES));
        }
        if (page.getReadLater() != null && page.getReadLater()) {
            doc.add(new StringField(DocFields.READ_LATER, "1", Field.Store.YES));
        }
        if (page.getPageJsonProperties() != null) {
            doc.add(new StoredField(DocFields.PAGE_JSON_PROPERTIES, page.getPageJsonProperties()));
        }
        if (page.getHighlightCount() != null) {
            doc.add(new IntPoint(DocFields.HIGHLIGHT_COUNT, page.getHighlightCount()));
            doc.add(new StoredField(DocFields.HIGHLIGHT_COUNT, page.getHighlightCount()));
        }
        // Store collectionId: use -1 for unsorted (null collectionId)
        long collectionIdValue = page.getCollectionId() != null ? page.getCollectionId() : -1L;
        doc.add(new LongPoint(DocFields.COLLECTION_ID, collectionIdValue));
        doc.add(new StoredField(DocFields.COLLECTION_ID, collectionIdValue));
        if (page.getCollectedAt() != null) {
            doc.add(new LongPoint(DocFields.COLLECTED_AT, page.getCollectedAt().getEpochSecond()));
            doc.add(new StoredField(DocFields.COLLECTED_AT, page.getCollectedAt().getEpochSecond()));
        }
        return doc;
    }

    private PageItem docToPageItem(Document doc) {
        var item = new PageItem();
        item.setId(Long.parseLong(doc.get(DocFields.ID)));
        if (doc.getField(DocFields.TITLE) != null) {
            item.setTitle(doc.get(DocFields.TITLE));
        }
        if (doc.getField(DocFields.DESCRIPTION) != null) {
            item.setDescription(doc.get(DocFields.DESCRIPTION));
        }
        if (doc.getField(DocFields.URL_TEXT) != null) {
            item.setUrl(doc.get(DocFields.URL_TEXT));
        }
        else if (doc.getField(DocFields.URL) != null) {
            item.setUrl(doc.get(DocFields.URL));
        }
        if (doc.getField(DocFields.AUTHOR) != null) {
            item.setAuthor(doc.get(DocFields.AUTHOR));
        }
        if (doc.getField(DocFields.THUMB_URL) != null) {
            item.setThumbUrl(doc.get(DocFields.THUMB_URL));
        }
        if (doc.getField(DocFields.SOURCE_ID) != null) {
            item.setSourceId(doc.getField(DocFields.SOURCE_ID).numericValue().intValue());
        }
        if (doc.getField(DocFields.CONNECTOR_ID) != null) {
            item.setConnectorId(doc.getField(DocFields.CONNECTOR_ID).numericValue().intValue());
        }
        if (doc.getField(DocFields.CONNECTOR_TYPE) != null) {
            item.setConnectorType(doc.getField(DocFields.CONNECTOR_TYPE).numericValue().intValue());
        }
        if (doc.getField(DocFields.CONTENT_TYPE) != null) {
            item.setContentType(doc.getField(DocFields.CONTENT_TYPE).numericValue().intValue());
        }
        if (doc.getField(DocFields.FOLDER_ID) != null) {
            item.setFolderId(doc.getField(DocFields.FOLDER_ID).numericValue().intValue());
        }
        if (doc.getField(DocFields.CREATED_AT) != null) {
            item.setRecordAt(Instant.ofEpochSecond(doc.getField(DocFields.CREATED_AT).numericValue().longValue()));
        }
        if (doc.getField(DocFields.LAST_READ_AT) != null) {
            item.setRecordAt(Instant.ofEpochSecond(doc.getField(DocFields.LAST_READ_AT).numericValue().longValue()));
        }
        if (doc.getField(DocFields.LIBRARY_SAVE_STATUS) != null) {
            item.setLibrarySaveStatus(doc.getField(DocFields.LIBRARY_SAVE_STATUS).numericValue().intValue());
        }
        if (doc.getField(DocFields.STARRED) != null) {
            item.setStarred("1".equals(doc.getField(DocFields.STARRED).stringValue()));
        }
        if (doc.getField(DocFields.READ_LATER) != null) {
            item.setReadLater("1".equals(doc.getField(DocFields.READ_LATER).stringValue()));
        }
        if (doc.getField(DocFields.PAGE_JSON_PROPERTIES) != null) {
            item.setPageJsonProperties(doc.get(DocFields.PAGE_JSON_PROPERTIES));
        }
        if (doc.getField(DocFields.HIGHLIGHT_COUNT) != null) {
            item.setHighlightCount(doc.getField(DocFields.HIGHLIGHT_COUNT).numericValue().intValue());
        }
        if (doc.getField(DocFields.COLLECTION_ID) != null) {
            long collectionIdValue = doc.getField(DocFields.COLLECTION_ID).numericValue().longValue();
            // -1 represents unsorted (null collectionId)
            if (collectionIdValue >= 0) {
                item.setCollectionId(collectionIdValue);
            }
        }
        if (doc.getField(DocFields.COLLECTED_AT) != null) {
            item.setCollectedAt(Instant.ofEpochSecond(doc.getField(DocFields.COLLECTED_AT).numericValue().longValue()));
        }
        return pageListService.updatePageItemRelationData(item);
    }

    public PageSearchResult searchPages(@NonNull SearchQuery searchQuery) {
        String keyword = searchQuery.getQ().trim();
        CompleteSearch completeSearch = extractCompleteSearch(keyword);
        keyword = completeSearch.getKeyword();

        PageSearchResult searchResult = new PageSearchResult();
        List<PageItem> pageItems = new ArrayList<>();
        searchResult.setItems(pageItems);
        List<String> words = segmentWords(keyword, true);
        SearchOption option = resolveSearchOption(searchQuery);

        try {
            Directory dir = getDirectory();
            if (DirectoryReader.indexExists(dir)) {
                try (DirectoryReader reader = DirectoryReader.open(dir)) {
                    IndexSearcher searcher = new IndexSearcher(reader);
                    List<FieldQueryInfo> fields = new ArrayList<>();
                    fields.add(new FieldQueryInfo().setName(DocFields.TITLE).setWildcard(true).setBoost(100));
                    if (!Boolean.TRUE.equals(option.getOnlySearchTitle())) {
                        fields.add(new FieldQueryInfo().setName(DocFields.CONTENT).setWildcard(true).setBoost(5));
                    }
                    var boolQueryBuilder = new BooleanQuery.Builder();
                    if (Boolean.TRUE.equals(option.getAlreadyRead())) {
                        Query query = LongPoint.newRangeQuery(DocFields.LAST_READ_AT, 1, Long.MAX_VALUE);
                        boolQueryBuilder.add(query, BooleanClause.Occur.MUST);
                    }
                    if (option.getType() != null) {
                        Query query = null;
                        switch (option.getType()) {
                            case TWEET:
                                query = IntPoint.newExactQuery(DocFields.CONTENT_TYPE, ContentType.TWEET.getCode());
                                break;
                            case GITHUB_STARRED_REPO:
                                query = IntPoint.newExactQuery(DocFields.CONNECTOR_TYPE, ConnectorType.GITHUB.getCode());
                                break;
                            case BROWSER_HISTORY:
                                query = IntPoint.newExactQuery(DocFields.CONTENT_TYPE, ContentType.BROWSER_HISTORY.getCode());
                                break;
                            case FEEDS:
                                query = IntPoint.newExactQuery(DocFields.CONNECTOR_TYPE, ConnectorType.RSS.getCode());
                                break;
                            default:
                                break;
                        }
                        if (query != null) {
                            boolQueryBuilder.add(query, BooleanClause.Occur.MUST);
                        }
                    }
                    if (option.getLibrary() != null) {
                        Query query = null;
                        switch (option.getLibrary()) {
                            case MY_LIST:
                                query = IntPoint.newExactQuery(DocFields.LIBRARY_SAVE_STATUS, LibrarySaveStatus.SAVED.getCode());
                                break;
                            case STARRED:
                                query = new TermQuery(new Term(DocFields.STARRED, "1"));
                                break;
                            case READ_LATER:
                                query = new TermQuery(new Term(DocFields.READ_LATER, "1"));
                                break;
                            case ARCHIVE:
                                query = IntPoint.newExactQuery(DocFields.LIBRARY_SAVE_STATUS, LibrarySaveStatus.ARCHIVED.getCode());
                                break;
                            case HIGHLIGHTS:
                                query = IntPoint.newRangeQuery(DocFields.HIGHLIGHT_COUNT, 1, Integer.MAX_VALUE);
                                break;
                            case UNSORTED:
                                // Unsorted: must be in library (librarySaveStatus > 0) AND no collection assigned
                                // For backward compatibility with old docs that don't have collection_id field:
                                // Match docs that do NOT have a valid collectionId (>= 1)
                                BooleanQuery.Builder unsortedBuilder = new BooleanQuery.Builder();
                                unsortedBuilder.add(IntPoint.newRangeQuery(DocFields.LIBRARY_SAVE_STATUS, 1, Integer.MAX_VALUE), BooleanClause.Occur.MUST);

                                // Exclude docs that have a valid collection (collectionId >= 1)
                                // This covers: collectionId = -1, collectionId = 0, or field doesn't exist (old docs)
                                unsortedBuilder.add(LongPoint.newRangeQuery(DocFields.COLLECTION_ID, 1L, Long.MAX_VALUE), BooleanClause.Occur.MUST_NOT);

                                query = unsortedBuilder.build();
                                break;
                            default:
                                break;
                        }
                        if (query != null) {
                            boolQueryBuilder.add(query, BooleanClause.Occur.MUST);
                        }
                    }

                    Query dateRangeQuery = buildSearchDateRangeQuery(searchQuery);
                    if (dateRangeQuery != null) {
                        boolQueryBuilder.add(dateRangeQuery, BooleanClause.Occur.MUST);
                    }

                    for (AdvancedSearch advancedSearch : completeSearch.advancedSearches) {
                        if (CollectionUtils.isEmpty(advancedSearch.words)) {
                            continue;
                        }
                        var advancedSearchQueryBuilder = new BooleanQuery.Builder();
                        for (String word : advancedSearch.words) {
                            var query = new WildcardQuery(new Term(advancedSearch.docField, "*" + word + "*"));
                            advancedSearchQueryBuilder.add(query, BooleanClause.Occur.SHOULD);
                        }
                        boolQueryBuilder.add(advancedSearchQueryBuilder.build(), BooleanClause.Occur.MUST);
                    }

                    // Filter by collection IDs if specified
                    if (!CollectionUtils.isEmpty(completeSearch.getCollectionIds())) {
                        var collectionQueryBuilder = new BooleanQuery.Builder();
                        for (Long collectionId : completeSearch.getCollectionIds()) {
                            Query collectionQuery = LongPoint.newExactQuery(DocFields.COLLECTION_ID, collectionId);
                            collectionQueryBuilder.add(collectionQuery, BooleanClause.Occur.SHOULD);
                        }
                        boolQueryBuilder.add(collectionQueryBuilder.build(), BooleanClause.Occur.MUST);
                    }

                    for (String word : words) {
                        var wordQueryBuilder = new BooleanQuery.Builder();
                        for (FieldQueryInfo field : fields) {
                            Query query;
                            if (field.isWildcard()) {
                                query = new WildcardQuery(new Term(field.getName(), "*" + word + "*"));
                            } else {
                                query = new TermQuery(new Term(field.getName(), word));
                            }
                            BoostQuery boosted = new BoostQuery(query, field.getBoost());
                            wordQueryBuilder.add(boosted, BooleanClause.Occur.SHOULD);
                        }
                        boolQueryBuilder.add(wordQueryBuilder.build(), BooleanClause.Occur.MUST);
                    }
                    StopWatch sw = new StopWatch();
                    sw.start();
                    var page = ObjectUtils.defaultIfNull(searchQuery.getPage(), 1);
                    var size = PageSizeUtils.getPageSize(searchQuery.getSize(), 100);
                    var maxPage = 10000;
                    int startIndex = (page - 1) * size;
                    TopScoreDocCollector collector = TopScoreDocCollector.create(page * size, maxPage);
                    searcher.search(boolQueryBuilder.build(), collector);
                    TopDocs docs = collector.topDocs(startIndex, size);
                    if (docs.totalHits.value > 0) {
                        var hits = docs.scoreDocs;
                        for (ScoreDoc hit : hits) {
                            var doc = searcher.doc(hit.doc);
                            PageItem item = docToPageItem(doc);
                            pageItems.add(item);
                        }
                    }
                    sw.stop();
                    searchResult.setPage(page);
                    searchResult.setTotalHits(docs.totalHits.value);
                    searchResult.setCostSeconds(sw.getTotalTimeSeconds());
                }
            }
        } catch (IOException e) {
            throw new RuntimeException(e);
        }

        return searchResult;
    }

    CompleteSearch extractCompleteSearch(String keyword) {
        CompleteSearch completeSearch = new CompleteSearch();
        completeSearch.setAdvancedSearches(new ArrayList<>());
        completeSearch.setCollectionIds(new ArrayList<>());
        List<String> keywords = splitSearchTokens(keyword);
        List<String> simpleWords = new ArrayList<>();
        for (String key : keywords) {
            if (StringUtils.isBlank(key)) {
                continue;
            }
            if (key.startsWith("url:")) {
                completeSearch.advancedSearches.add(extractAdvancedSearch(key, DocFields.URL_TEXT, ":"));
            } else if (key.startsWith("author:")) {
                completeSearch.advancedSearches.add(extractAdvancedSearch(key, DocFields.AUTHOR, ":"));
            } else if (key.startsWith("collection:")) {
                String collectionName = key.substring("collection:".length());
                if (StringUtils.isNotBlank(collectionName)) {
                    var collections = collectionRepository.findByNameContainingIgnoreCase(collectionName);
                    if (!collections.isEmpty()) {
                        completeSearch.getCollectionIds().addAll(
                            collections.stream().map(c -> c.getId()).collect(Collectors.toList())
                        );
                    }
                }
            } else {
                simpleWords.add(key);
            }
        }
        completeSearch.keyword = String.join(" ", simpleWords);
        return completeSearch;
    }

    private AdvancedSearch extractAdvancedSearch(String key, String docField, String seperator) {
        AdvancedSearch advancedSearch = new AdvancedSearch();
        advancedSearch.setDocField(docField);
        advancedSearch.setKeyword(extractAdvancedSearchKeyword(key, seperator));
        advancedSearch.words = segmentWords(advancedSearch.getKeyword(), true);
        return advancedSearch;
    }

    static String extractAdvancedSearchKeyword(String key, String separator) {
        int separatorIndex = key.indexOf(separator);
        if (separatorIndex < 0) {
            return "";
        }
        return key.substring(separatorIndex + separator.length()).trim();
    }

    static List<String> splitSearchTokens(String keyword) {
        List<String> tokens = new ArrayList<>();
        if (StringUtils.isBlank(keyword)) {
            return tokens;
        }

        StringBuilder token = new StringBuilder();
        boolean inQuotes = false;
        boolean escaping = false;

        for (int i = 0; i < keyword.length(); i++) {
            char current = keyword.charAt(i);

            if (escaping) {
                token.append(current);
                escaping = false;
                continue;
            }

            if (inQuotes && current == '\\') {
                escaping = true;
                continue;
            }

            if (current == '"') {
                inQuotes = !inQuotes;
                continue;
            }

            if (!inQuotes && Character.isWhitespace(current)) {
                if (token.length() > 0) {
                    tokens.add(token.toString());
                    token.setLength(0);
                }
                continue;
            }

            token.append(current);
        }

        if (escaping) {
            token.append('\\');
        }

        if (token.length() > 0) {
            tokens.add(token.toString());
        }

        return tokens;
    }

    SearchOption resolveSearchOption(SearchQuery searchQuery) {
        SearchOption option = parseSearchOption(searchQuery != null ? searchQuery.getQueryOptions() : null);
        if (searchQuery == null) {
            return option;
        }

        SearchOption.Type type = parseSearchType(searchQuery.getContentType());
        if (type != null) {
            option.setType(type);
        }

        SearchOption.Library library = parseLibraryFilter(searchQuery.getLibraryFilter());
        if (library != null) {
            option.setLibrary(library);
        }

        if (searchQuery.getAlreadyRead() != null) {
            option.setAlreadyRead(searchQuery.getAlreadyRead());
        }
        if (searchQuery.getSearchTitleOnly() != null) {
            option.setOnlySearchTitle(searchQuery.getSearchTitleOnly());
        }
        return option;
    }

    private SearchOption parseSearchOption(String options) {
        SearchOption option = new SearchOption();
        if (StringUtils.isNotBlank(options)) {
            String[] keywords = options.split(",");
            for (String key : keywords) {
                SearchOption.Type type = parseSearchType(key);
                if (type != null) {
                    option.setType(type);
                    continue;
                }

                SearchOption.Library library = parseLibraryFilter(key);
                if (library != null) {
                    option.setLibrary(library);
                    continue;
                }

                switch (StringUtils.lowerCase(StringUtils.trimToEmpty(key))) {
                    case "read":
                        option.setAlreadyRead(true);
                        break;
                    case "title":
                        option.setOnlySearchTitle(true);
                        break;
                    default:
                        break;
                }
            }
        }
        return option;
    }

    private SearchOption.Type parseSearchType(String contentType) {
        switch (StringUtils.lowerCase(StringUtils.trimToEmpty(contentType))) {
            case "tweet":
                return SearchOption.Type.TWEET;
            case "github":
                return SearchOption.Type.GITHUB_STARRED_REPO;
            case "browser":
                return SearchOption.Type.BROWSER_HISTORY;
            case "feeds":
                return SearchOption.Type.FEEDS;
            default:
                return null;
        }
    }

    private SearchOption.Library parseLibraryFilter(String libraryFilter) {
        switch (StringUtils.lowerCase(StringUtils.trimToEmpty(libraryFilter))) {
            case "highlights":
                return SearchOption.Library.HIGHLIGHTS;
            case "list":
                return SearchOption.Library.MY_LIST;
            case "starred":
                return SearchOption.Library.STARRED;
            case "archive":
                return SearchOption.Library.ARCHIVE;
            case "later":
                return SearchOption.Library.READ_LATER;
            case "unsorted":
                return SearchOption.Library.UNSORTED;
            default:
                return null;
        }
    }

    Query buildSearchDateRangeQuery(SearchQuery searchQuery) {
        SearchDateRange dateRange = resolveSearchDateRange(searchQuery);
        if (dateRange == null) {
            return null;
        }
        if (dateRange.getEndEpochSecond() < dateRange.getStartEpochSecond()) {
            return new MatchNoDocsQuery("Invalid search date range");
        }
        return LongPoint.newRangeQuery(dateRange.getDocField(), dateRange.getStartEpochSecond(), dateRange.getEndEpochSecond());
    }

    SearchDateRange resolveSearchDateRange(SearchQuery searchQuery) {
        if (searchQuery == null || (StringUtils.isBlank(searchQuery.getStartDate()) && StringUtils.isBlank(searchQuery.getEndDate()))) {
            return null;
        }

        Instant start = parseSearchDate(searchQuery.getStartDate(), 0);
        Instant end = parseSearchDate(searchQuery.getEndDate(), 1);
        long startEpochSecond = start != null ? start.getEpochSecond() : Long.MIN_VALUE;
        long endEpochSecond = end != null ? end.getEpochSecond() - 1 : Long.MAX_VALUE;
        return new SearchDateRange()
                .setDocField(resolveSearchDateField(searchQuery.getDateField()))
                .setStartEpochSecond(startEpochSecond)
                .setEndEpochSecond(endEpochSecond);
    }

    private String resolveSearchDateField(String dateField) {
        switch (StringUtils.lowerCase(StringUtils.trimToEmpty(dateField))) {
            case "collected_at":
            case "collectedat":
            case "collected":
                return DocFields.COLLECTED_AT;
            case "last_read_at":
            case "lastreadat":
            case "read_at":
            case "readat":
            case "read":
                return DocFields.LAST_READ_AT;
            case "created_at":
            case "createdat":
            case "created":
            default:
                return DocFields.CREATED_AT;
        }
    }

    private Instant parseSearchDate(String date, int plusDay) {
        if (StringUtils.isBlank(date)) {
            return null;
        }
        if (date.contains("T") || date.contains(":")) {
            return parseSearchDateTime(date);
        }
        return LocalDate.parse(date).atStartOfDay(ZoneId.systemDefault()).toInstant().plus(plusDay, ChronoUnit.DAYS);
    }

    private Instant parseSearchDateTime(String dateTime) {
        try {
            return Instant.parse(dateTime);
        } catch (DateTimeParseException e) {
            try {
                return OffsetDateTime.parse(dateTime).toInstant();
            } catch (DateTimeParseException offsetException) {
                return LocalDateTime.parse(dateTime).atZone(ZoneId.systemDefault()).toInstant();
            }
        }
    }

    private List<String> segmentWords(String keyword, boolean useSmart) {
        List<String> words = new ArrayList<>();
        if (StringUtils.isBlank(keyword)) {
            return words;
        }
        StringReader sr = new StringReader(keyword);
        IKSegmenter segmenter = new IKSegmenter(sr, useSmart);
        Lexeme lexeme = null;
        while (true) {
            try {
                if ((lexeme = segmenter.next()) == null) {
                    break;
                }
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
            words.add(lexeme.getLexemeText());
        }
        return words;
    }

    public void deletePage(Long id) {
        ensureLuceneIndexWriter();
        try {
            writer.deleteDocuments(new Term("id", id.toString()));
            writer.commit();
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }

    @Setter
    @Getter
    @Accessors(chain = true)
    static class FieldQueryInfo {
        private String name;
        private float boost;
        private boolean wildcard;
    }

    @Getter
    @Setter
    static class CompleteSearch {
        private String keyword;
        private List<AdvancedSearch> advancedSearches;
        private List<Long> collectionIds;
    }

    @Getter
    @Setter
    static class AdvancedSearch {
        private String docField;
        private String keyword;
        private List<String> words;
    }

    @Getter
    @Setter
    @Accessors(chain = true)
    static class SearchDateRange {
        private String docField;
        private long startEpochSecond;
        private long endEpochSecond;
    }
}
