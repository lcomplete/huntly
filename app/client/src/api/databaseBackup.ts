import axios from "axios";

export interface DatabaseBackupInfo {
  fileName?: string;
  createdAt?: string;
  sizeBytes?: number;
}

type ApiResult<T> = {
  code: number;
  message?: string;
  data: T;
};

export async function fetchDatabaseBackups(): Promise<DatabaseBackupInfo[]> {
  const res = await axios.get<ApiResult<DatabaseBackupInfo[]>>("/api/setting/general/database-backups");
  if (res.data.code !== 0) {
    throw new Error(res.data.message || "Failed to fetch database backups.");
  }
  return res.data.data || [];
}

export function getDatabaseBackupDownloadUrl(fileName: string): string {
  return `/api/setting/general/database-backups/download?fileName=${encodeURIComponent(fileName)}`;
}