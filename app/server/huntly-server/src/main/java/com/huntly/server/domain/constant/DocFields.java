package com.huntly.server.domain.constant;

import lombok.experimental.UtilityClass;

/**
 * lucene page doc fields
 * @author lcomplete
 */
@UtilityClass
public class DocFields {
    public static final String ID = "id";
    public static final String TITLE = "title";
    public static final String CONTENT = "content";
    public static final String DESCRIPTION = "description";
    public static final String SOURCE_ID = "sourceId";
    public static final String CONNECTOR_ID = "connectorId";
    public static final String CONNECTOR_TYPE = "connectorType";
    public static final String FOLDER_ID = "folderId";
    public static final String CREATED_AT = "createdAt";
    public static final String LAST_READ_AT = "lastReadAt";
    public static final String LIBRARY_SAVE_STATUS = "librarySaveStatus";
    public static final String STARRED = "starred";
    public static final String READ_LATER = "readLater";
    @Deprecated
    public static final String URL = "url";
    public static final String URL_TEXT = "url_text";
    public static final String THUMB_URL = "thumbUrl";
    public static final String PAGE_JSON_PROPERTIES= "pageJsonProperties";
    public static final String CONTENT_TYPE = "contentType";
    public static final String AUTHOR = "author_text";
    public static final String HIGHLIGHT_COUNT = "highlightCount";
}
