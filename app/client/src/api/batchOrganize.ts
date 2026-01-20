import axios from "axios";

/**
 * Simplified page item for batch organize display.
 */
export interface BatchPageItem {
  id: number;
  contentType: number;
  title: string | null;
  description: string | null;
  url: string;
  author: string | null;
  pageJsonProperties: string | null;
  collectedAt: string | null;
  publishTime: string | null;
}

/**
 * Content type for filtering.
 * - ALL: All content types
 * - ARTICLE: Regular articles (BROWSER_HISTORY, MARKDOWN)
 * - TWEET: Tweets (TWEET, QUOTED_TWEET)
 * - SNIPPET: Page snippets
 */
export type ContentTypeFilter = "ALL" | "ARTICLE" | "TWEET" | "SNIPPET";

/**
 * Collected time mode options.
 * - KEEP: Keep original collected time (don't modify)
 * - USE_PUBLISH_TIME: Set collected time to publish time (connectedAt)
 */
export type CollectedAtMode = "KEEP" | "USE_PUBLISH_TIME";

/**
 * Query parameters for batch filtering.
 */
export interface BatchFilterQuery {
  saveStatus?: "ALL" | "SAVED" | "ARCHIVED";
  contentType?: ContentTypeFilter;
  collectionId?: number | null; // null means unsorted
  filterUnsorted?: boolean;
  starred?: boolean;
  readLater?: boolean;
  author?: string; // Filter by author (partial match)
  startDate?: string; // Filter by createdAt (YYYY-MM-DD)
  endDate?: string;   // Filter by createdAt (YYYY-MM-DD)
  page?: number;
  size?: number;
}

/**
 * Result of batch filter query.
 */
export interface BatchFilterResult {
  totalCount: number;
  items: BatchPageItem[];
  currentPage: number;
  totalPages: number;
}

/**
 * Request for batch moving pages to a collection.
 */
export interface BatchMoveRequest {
  selectAll: boolean;
  pageIds?: number[];
  filterQuery?: BatchFilterQuery;
  targetCollectionId: number | null;
  collectedAtMode: CollectedAtMode;
}

/**
 * Result of batch move operation.
 */
export interface BatchMoveResult {
  successCount: number;
  totalAffected: number;
}

type ApiResult<T> = {
  code: number;
  message?: string;
  data: T;
};

/**
 * Filter pages with pagination for batch operations.
 */
export async function filterPages(
  query: BatchFilterQuery
): Promise<BatchFilterResult> {
  const res = await axios.post<ApiResult<BatchFilterResult>>(
    "/api/page/batch/filter",
    query
  );
  if (res.data.code !== 0) {
    throw new Error(res.data.message || "Failed to filter pages.");
  }
  return res.data.data;
}

/**
 * Batch move pages to a collection.
 */
export async function batchMoveToCollection(
  request: BatchMoveRequest
): Promise<BatchMoveResult> {
  const res = await axios.post<ApiResult<BatchMoveResult>>(
    "/api/page/batch/moveToCollection",
    request
  );
  if (res.data.code !== 0) {
    throw new Error(res.data.message || "Failed to move pages.");
  }
  return res.data.data;
}

/**
 * Collected time mode options with labels for UI.
 */
export const COLLECTED_AT_MODE_OPTIONS: { value: CollectedAtMode; label: string }[] = [
  { value: "KEEP", label: "Keep Original" },
  { value: "USE_PUBLISH_TIME", label: "Use Publish Time" },
];

