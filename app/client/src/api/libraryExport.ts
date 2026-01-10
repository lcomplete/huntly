import axios from "axios";

export type LibraryExportStatus = "EMPTY" | "IN_PROGRESS" | "READY" | "FAILED" | "MISSING";

export interface LibraryExportInfo {
  fileName?: string;
  status?: LibraryExportStatus;
  startedAt?: string;
  completedAt?: string;
  sizeBytes?: number;
  message?: string;
}

type ApiResult<T> = {
  code: number;
  message?: string;
  data: T;
};

export async function startLibraryExport(): Promise<LibraryExportInfo> {
  const res = await axios.post<ApiResult<LibraryExportInfo>>("/api/library-export/start");
  if (res.data.code !== 0) {
    throw new Error(res.data.message || "Failed to start export.");
  }
  return res.data.data;
}

export async function fetchLatestLibraryExport(): Promise<LibraryExportInfo> {
  const res = await axios.get<ApiResult<LibraryExportInfo>>("/api/library-export/latest");
  if (res.data.code !== 0) {
    throw new Error(res.data.message || "Failed to fetch export info.");
  }
  return res.data.data;
}

export async function fetchLibraryExportStatus(fileName: string): Promise<LibraryExportInfo> {
  const res = await axios.get<ApiResult<LibraryExportInfo>>("/api/library-export/status", {
    params: { fileName },
  });
  if (res.data.code !== 0) {
    throw new Error(res.data.message || "Failed to fetch export status.");
  }
  return res.data.data;
}

export function getLibraryExportDownloadUrl(fileName: string): string {
  return `/api/library-export/download?fileName=${encodeURIComponent(fileName)}`;
}
