export interface SyncSettings {
  server_url: string;
  export_folder: string;
  sync_enabled: boolean;
  sync_interval_seconds: number;
  last_sync_at: string | null;
  /** Persisted remote server URL, used to restore configuration when switching back from local mode */
  remote_server_url?: string | null;
}

export interface SyncState {
  is_syncing: boolean;
  last_sync_status: string | null;
  last_sync_error: string | null;
  synced_count: number;
  logs: string[];
}

export interface LoginResult {
  success: boolean;
  message: string;
  token: string | null;
}

export interface SyncResult {
  synced_count: number;
  skipped_count: number;
  errors: string[];
  is_incremental: boolean;
}

export interface PageItem {
  id: number;
  title: string | null;
  url: string | null;
  author: string | null;
  description: string | null;
  domain: string | null;
  connectorType: number | null;
  contentType: number | null;
  recordAt: string | null;
  connectedAt: string | null;
  pageJsonProperties: string | null;
  starred: boolean | null;
  readLater: boolean | null;
  category: string | null;
  siteName: string | null;
}
