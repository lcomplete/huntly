use serde::{Deserialize, Serialize};
use std::sync::Mutex;

lazy_static::lazy_static! {
    pub static ref SYNC_STATE: Mutex<SyncState> = Mutex::new(SyncState::default());
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SyncSettings {
    pub server_url: String,
    pub export_folder: String,
    pub sync_enabled: bool,
    pub sync_interval_seconds: u64,
    pub last_sync_at: Option<String>,
    #[serde(default)]
    pub remote_server_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SyncState {
    pub is_syncing: bool,
    pub last_sync_status: Option<String>,
    pub last_sync_error: Option<String>,
    pub synced_count: u32,
    #[serde(default)]
    pub logs: Vec<String>,
}

/// 元数据项（不包含 content）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncItemMeta {
    pub id: i64,
    pub title: Option<String>,
    pub url: Option<String>,
    pub author: Option<String>,
    #[serde(rename = "authorScreenName")]
    pub author_screen_name: Option<String>,
    #[serde(rename = "connectorType")]
    pub connector_type: Option<i32>,
    #[serde(rename = "connectorId")]
    pub connector_id: Option<i32>,
    #[serde(rename = "connectorName")]
    pub connector_name: Option<String>,
    #[serde(rename = "folderId")]
    pub folder_id: Option<i32>,
    #[serde(rename = "folderName")]
    pub folder_name: Option<String>,
    #[serde(rename = "contentType")]
    pub content_type: Option<i32>,
    #[serde(rename = "savedAt")]
    pub saved_at: Option<String>,
    #[serde(rename = "archivedAt")]
    pub archived_at: Option<String>,
    #[serde(rename = "updatedAt")]
    pub updated_at: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<String>,
    #[serde(rename = "lastReadAt")]
    pub last_read_at: Option<String>,
    pub starred: Option<bool>,
    #[serde(rename = "readLater")]
    pub read_later: Option<bool>,
    #[serde(rename = "librarySaveStatus")]
    pub library_save_status: Option<i32>,
    #[serde(rename = "highlightCount")]
    pub highlight_count: Option<i32>,
    #[serde(rename = "thumbUrl")]
    pub thumb_url: Option<String>,
    #[serde(rename = "pageJsonProperties")]
    pub page_json_properties: Option<String>,
}

/// 列表响应（支持游标分页）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncListResponse {
    pub items: Vec<SyncItemMeta>,
    #[serde(rename = "hasMore")]
    pub has_more: bool,
    #[serde(rename = "nextCursorAt")]
    pub next_cursor_at: Option<String>,
    #[serde(rename = "nextCursorId")]
    pub next_cursor_id: Option<i64>,
    pub count: Option<i32>,
    #[serde(rename = "syncAt")]
    pub sync_at: Option<String>,
}

/// 内容响应（按需获取）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncContentResponse {
    pub id: i64,
    pub title: Option<String>,
    pub content: Option<String>,
    pub markdown: Option<String>,
    #[serde(rename = "updatedAt")]
    pub updated_at: Option<String>,
    pub highlights: Option<Vec<HighlightInfo>>,
}

/// 高亮信息（用于内容响应）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HighlightInfo {
    pub id: i64,
    pub text: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<String>,
}

/// 高亮同步项（直接从 PageHighlight 表获取）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncHighlightItem {
    pub id: i64,
    #[serde(rename = "pageId")]
    pub page_id: i64,
    #[serde(rename = "highlightedText")]
    pub highlighted_text: Option<String>,
    #[serde(rename = "pageTitle")]
    pub page_title: Option<String>,
    #[serde(rename = "pageUrl")]
    pub page_url: Option<String>,
    pub author: Option<String>,
    #[serde(rename = "contentType")]
    pub content_type: Option<i32>,
    #[serde(rename = "connectorType")]
    pub connector_type: Option<i32>,
    #[serde(rename = "connectorId")]
    pub connector_id: Option<i32>,
    #[serde(rename = "connectorName")]
    pub connector_name: Option<String>,
    #[serde(rename = "folderId")]
    pub folder_id: Option<i32>,
    #[serde(rename = "folderName")]
    pub folder_name: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<String>,
    #[serde(rename = "updatedAt")]
    pub updated_at: Option<String>,
    #[serde(rename = "pageUpdatedAt")]
    pub page_updated_at: Option<String>,
}

/// 高亮同步列表响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncHighlightListResponse {
    pub items: Vec<SyncHighlightItem>,
    #[serde(rename = "hasMore")]
    pub has_more: bool,
    #[serde(rename = "nextCursorAt")]
    pub next_cursor_at: Option<String>,
    #[serde(rename = "nextCursorId")]
    pub next_cursor_id: Option<i64>,
    pub count: Option<i32>,
    #[serde(rename = "syncAt")]
    pub sync_at: Option<String>,
}

/// 目录索引项（精简版，不含描述和内容）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexItem {
    pub id: i64,
    pub filename: String,
    #[serde(rename = "type")]
    pub item_type: String, // "x" 或 "page"
    #[serde(rename = "contentType")]
    pub content_type: Option<i32>,
    #[serde(rename = "connectorType")]
    pub connector_type: Option<i32>,
    #[serde(rename = "connectorId")]
    pub connector_id: Option<i32>,
    #[serde(rename = "folderId")]
    pub folder_id: Option<i32>,
    pub starred: Option<bool>,
    #[serde(rename = "readLater")]
    pub read_later: Option<bool>,
    #[serde(rename = "savedAt")]
    pub saved_at: Option<String>,
    #[serde(rename = "updatedAt")]
    pub updated_at: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<String>,
    #[serde(rename = "lastReadAt")]
    pub last_read_at: Option<String>,
    #[serde(rename = "archivedAt")]
    pub archived_at: Option<String>,
    #[serde(rename = "highlightCount")]
    pub highlight_count: Option<i32>,
}

/// 目录索引文件结构
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategoryIndex {
    pub category: String,
    #[serde(rename = "syncAt")]
    pub sync_at: String,
    #[serde(rename = "totalCount")]
    pub total_count: usize,
    pub items: Vec<IndexItem>,
}

/// 高亮索引项
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HighlightIndexItem {
    pub id: i64,
    #[serde(rename = "pageId")]
    pub page_id: i64,
    pub filename: String,
    #[serde(rename = "pageTitle")]
    pub page_title: Option<String>,
    #[serde(rename = "pageUrl")]
    pub page_url: Option<String>,
    #[serde(rename = "contentType")]
    pub content_type: Option<i32>,
    #[serde(rename = "connectorType")]
    pub connector_type: Option<i32>,
    #[serde(rename = "connectorId")]
    pub connector_id: Option<i32>,
    #[serde(rename = "folderId")]
    pub folder_id: Option<i32>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<String>,
}

/// 高亮索引文件结构
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HighlightIndex {
    pub category: String,
    #[serde(rename = "syncAt")]
    pub sync_at: String,
    #[serde(rename = "totalCount")]
    pub total_count: usize,
    pub items: Vec<HighlightIndexItem>,
}

/// 游标文件结构（用于增量同步）
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CursorData {
    #[serde(rename = "lastCursorAt")]
    pub last_cursor_at: Option<String>,
    #[serde(rename = "lastCursorId")]
    pub last_cursor_id: Option<i64>,
    #[serde(rename = "lastSyncAt")]
    pub last_sync_at: Option<String>,
}

/// 原始 PageItem（用于 fetch_library_pages）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PageItem {
    pub id: i64,
    pub title: Option<String>,
    pub url: Option<String>,
    pub author: Option<String>,
    pub domain: Option<String>,
    #[serde(rename = "connectorType")]
    pub connector_type: Option<i32>,
    #[serde(rename = "contentType")]
    pub content_type: Option<i32>,
    #[serde(rename = "recordAt")]
    pub record_at: Option<String>,
    #[serde(rename = "connectedAt")]
    pub connected_at: Option<String>,
    #[serde(rename = "updatedAt")]
    pub updated_at: Option<String>,
    #[serde(rename = "pageJsonProperties")]
    pub page_json_properties: Option<String>,
    pub starred: Option<bool>,
    #[serde(rename = "readLater")]
    pub read_later: Option<bool>,
    pub category: Option<String>,
    #[serde(rename = "siteName")]
    pub site_name: Option<String>,
}
