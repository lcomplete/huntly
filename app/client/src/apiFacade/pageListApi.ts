import { PageControllerApiFactory, PageItem } from "../api";
import { ConnectorType } from "../interfaces/connectorType";

/**
 * Page list query options interface
 */
export interface PageListOptions {
    asc?: boolean;
    collectionId?: number;
    connectorId?: number;
    connectorType?: ConnectorType;
    contentFilterType?: number;
    contentType?: 'BROWSER_HISTORY' | 'MARKDOWN' | 'QUOTED_TWEET' | 'SNIPPET' | 'TWEET';
    count?: number;
    endDate?: string;
    filterUnsorted?: boolean;
    firstRecordAt?: string;
    firstVoteScore?: number;
    folderId?: number;
    hasHighlights?: boolean;
    includeArchived?: boolean;
    lastRecordAt?: string;
    lastVoteScore?: number;
    markRead?: boolean;
    readLater?: boolean;
    saveStatus?: 'ARCHIVED' | 'NOT_SAVED' | 'SAVED';
    sort?: 'ARCHIVED_AT' | 'COLLECTED_AT' | 'CONNECTED_AT' | 'CREATED_AT' | 'LAST_READ_AT' | 'READ_LATER_AT' | 'SAVED_AT' | 'STARRED_AT' | 'VOTE_SCORE';
    sourceId?: number;
    starred?: boolean;
    startDate?: string;
}

/**
 * Fetch page items with a typed options object
 * This provides a cleaner interface than the raw API with positional parameters
 */
export async function fetchPageItems(options: PageListOptions = {}): Promise<PageItem[]> {
    const response = await PageControllerApiFactory().listPageItemsUsingGET(
        options.asc,
        options.collectionId,
        options.connectorId,
        options.connectorType,
        options.contentFilterType,
        options.contentType,
        options.count,
        options.endDate,
        options.filterUnsorted,
        options.firstRecordAt,
        options.firstVoteScore,
        options.folderId,
        options.hasHighlights,
        options.includeArchived,
        options.lastRecordAt,
        options.lastVoteScore,
        options.markRead,
        options.readLater,
        options.saveStatus,
        options.sort,
        options.sourceId,
        options.starred,
        options.startDate
    );
    return response.data || [];
}
