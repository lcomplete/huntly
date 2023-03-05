package com.huntly.server.service;

import com.huntly.interfaces.external.dto.PageItem;
import com.huntly.interfaces.external.dto.PageSearchResult;
import com.huntly.interfaces.external.model.ContentType;
import com.huntly.interfaces.external.model.LibrarySaveStatus;
import com.huntly.interfaces.external.model.SearchOption;
import com.huntly.interfaces.external.query.SearchQuery;
import com.huntly.server.connector.ConnectorType;
import com.huntly.server.domain.constant.AppConstants;
import com.huntly.server.domain.constant.DocFields;
import com.huntly.server.domain.entity.Page;
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
import org.springframework.util.StopWatch;
import org.wltea.analyzer.core.IKSegmenter;
import org.wltea.analyzer.core.Lexeme;
import org.wltea.analyzer.lucene.IKAnalyzer;

import java.io.File;
import java.io.IOException;
import java.io.StringReader;
import java.nio.file.Paths;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * @author lcomplete
 */
@Service
public class LuceneService implements DisposableBean {

    private final String indexDirPath;

    private final PageRepository pageRepository;

    private final PageListService pageListService;

    private IndexWriter writer;

    public LuceneService(PageRepository pageRepository, PageListService pageListService) {
        this.pageListService = pageListService;
        indexDirPath = AppConstants.LUCENE_INDEX_PATH;
        this.pageRepository = pageRepository;
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
                DirectoryReader reader = DirectoryReader.open(dir);
                IndexSearcher searcher = new IndexSearcher(reader);
                Query idQuery = new TermQuery(new Term("id", page.getId().toString()));
                TopDocs docs = searcher.search(idQuery, 1);
                docExists = docs.totalHits.value > 0;
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
        if (StringUtils.isNotBlank(page.getUrl())) {
            doc.add(new StringField(DocFields.URL, page.getUrl(), Field.Store.YES));
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
        if (doc.getField(DocFields.URL) != null) {
            item.setUrl(doc.get(DocFields.URL));
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
        return pageListService.updatePageItemRelationData(item);
    }

    public PageSearchResult searchPages(@NonNull SearchQuery searchQuery) {
        String keyword = searchQuery.getQ().trim();

        PageSearchResult searchResult = new PageSearchResult();
        List<PageItem> pageItems = new ArrayList<>();
        searchResult.setItems(pageItems);
        List<String> words = segmentWords(keyword, true);
        SearchOption option = parseSearchOption(searchQuery.getQueryOptions());

        try {
            Directory dir = getDirectory();
            if (DirectoryReader.indexExists(dir)) {
                DirectoryReader reader = DirectoryReader.open(dir);
                IndexSearcher searcher = new IndexSearcher(reader);
                List<FieldQueryInfo> fields = new ArrayList<>();
                fields.add(new FieldQueryInfo().setName(DocFields.TITLE).setWildcard(true).setBoost(100));
                if (!Boolean.TRUE.equals(option.getOnlySearchTitle())) {
                    fields.add(new FieldQueryInfo().setName(DocFields.CONTENT).setWildcard(true).setBoost(5));
                }
                //fields.add(new FieldQueryInfo().setName(DocFields.DESCRIPTION).setBoost(5));
                //fields.add(new FieldQueryInfo().setName(DocFields.URL).setWildcard(true).setBoost(1));
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
                        default:
                            break;
                    }
                    if (query != null) {
                        boolQueryBuilder.add(query, BooleanClause.Occur.MUST);
                    }
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
        } catch (IOException e) {
            throw new RuntimeException(e);
        }

        return searchResult;
    }

    private SearchOption parseSearchOption(String options) {
        SearchOption option = new SearchOption();
        if (StringUtils.isNotBlank(options)) {
            String[] keywords = options.split(",");
            for (String key : keywords) {
                switch (key) {
                    case "tweet":
                        option.setType(SearchOption.Type.TWEET);
                        break;
                    case "github":
                        option.setType(SearchOption.Type.GITHUB_STARRED_REPO);
                        break;
                    case "browser":
                        option.setType(SearchOption.Type.BROWSER_HISTORY);
                        break;
                    case "feeds":
                        option.setType(SearchOption.Type.FEEDS);
                        break;
                    case "list":
                        option.setLibrary(SearchOption.Library.MY_LIST);
                        break;
                    case "starred":
                        option.setLibrary(SearchOption.Library.STARRED);
                        break;
                    case "archive":
                        option.setLibrary(SearchOption.Library.ARCHIVE);
                        break;
                    case "later":
                        option.setLibrary(SearchOption.Library.READ_LATER);
                        break;
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

    private List<String> segmentWords(String keyword, boolean useSmart) {
        List<String> words = new ArrayList<>();
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
}
