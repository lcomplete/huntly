import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {Alert, Button, Divider, Link, Typography} from "@mui/material";
import {useSnackbar} from "notistack";
import {
  fetchLatestLibraryExport,
  fetchLibraryExportStatus,
  getLibraryExportDownloadUrl,
  LibraryExportInfo,
  LibraryExportStatus,
  startLibraryExport
} from "../../api/libraryExport";

const POLL_INTERVAL_MS = 5000;

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export default function LibrarySetting() {
  const {enqueueSnackbar} = useSnackbar();
  const [exportInfo, setExportInfo] = useState<LibraryExportInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const lastStatusRef = useRef<LibraryExportStatus | undefined>(undefined);

  const loadLatest = useCallback(async () => {
    try {
      setIsLoading(true);
      const info = await fetchLatestLibraryExport();
      setExportInfo(info);
      lastStatusRef.current = info?.status;
    } catch (error) {
      enqueueSnackbar("Failed to load export status. Please try again.", {
        variant: "error",
        anchorOrigin: {vertical: "bottom", horizontal: "center"}
      });
    } finally {
      setIsLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    loadLatest();
  }, [loadLatest]);

  const isPreparing = exportInfo?.status === "IN_PROGRESS";
  const hasReadyFile = exportInfo?.status === "READY" && !!exportInfo.fileName;

  useEffect(() => {
    if (!isPreparing || !exportInfo?.fileName) {
      return;
    }
    let isMounted = true;
    const poll = async () => {
      try {
        const info = await fetchLibraryExportStatus(exportInfo.fileName as string);
        if (!isMounted) {
          return;
        }
        const previousStatus = lastStatusRef.current;
        lastStatusRef.current = info?.status;
        setExportInfo(info);
        if (previousStatus === "IN_PROGRESS" && info?.status === "READY") {
          enqueueSnackbar("Export ready. Download it below.", {
            variant: "success",
            anchorOrigin: {vertical: "bottom", horizontal: "center"}
          });
        }
        if (previousStatus === "IN_PROGRESS" && info?.status === "FAILED") {
          enqueueSnackbar("Export failed. Please try again.", {
            variant: "error",
            anchorOrigin: {vertical: "bottom", horizontal: "center"}
          });
        }
      } catch (error) {
        if (isMounted) {
          enqueueSnackbar("Failed to refresh export status.", {
            variant: "warning",
            anchorOrigin: {vertical: "bottom", horizontal: "center"}
          });
        }
      }
    };
    const timer = setInterval(poll, POLL_INTERVAL_MS);
    poll();
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [enqueueSnackbar, exportInfo?.fileName, isPreparing]);

  const handleExport = useCallback(async () => {
    try {
      const info = await startLibraryExport();
      setExportInfo(info);
      lastStatusRef.current = info?.status;
      enqueueSnackbar("Export started. We will notify you when it is ready.", {
        variant: "info",
        anchorOrigin: {vertical: "bottom", horizontal: "center"}
      });
    } catch (error) {
      enqueueSnackbar("Failed to start export. Please try again.", {
        variant: "error",
        anchorOrigin: {vertical: "bottom", horizontal: "center"}
      });
    }
  }, [enqueueSnackbar]);

  const completedAtLabel = useMemo(() => {
    if (!exportInfo?.completedAt) {
      return "";
    }
    return new Date(exportInfo.completedAt).toLocaleString();
  }, [exportInfo?.completedAt]);

  return (
    <div>
      <Typography variant={'h6'}>
        Library Export
      </Typography>
      <Divider />
      <Typography variant="body2" className="mt-2 text-gray-600">
        Export your Library entries as Markdown files packaged in a ZIP archive.
      </Typography>

      <div className="mt-4 flex items-center gap-3">
        <Button
          variant="contained"
          onClick={handleExport}
          disabled={isPreparing || isLoading}
        >
          Export Library
        </Button>
        {isPreparing && (
          <Typography variant="body2" className="text-gray-600">
            Preparing your export...
          </Typography>
        )}
      </div>

      <div className="mt-4">
        {!isLoading && exportInfo?.status === "FAILED" && (
          <Alert severity="error">
            {exportInfo?.message || "Export failed. Please try again."}
          </Alert>
        )}
        {!isLoading && exportInfo?.status === "IN_PROGRESS" && (
          <Alert severity="info">
            Your export is being generated. This page will update automatically.
          </Alert>
        )}
        {!isLoading && hasReadyFile && (
          <Alert severity="success">
            <div className="flex flex-col gap-1">
              <div>Export ready for download.</div>
              <div>
                <Link
                  href={getLibraryExportDownloadUrl(exportInfo.fileName as string)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {exportInfo.fileName}
                </Link>
              </div>
              <div className="text-xs text-gray-500">
                {formatBytes(exportInfo.sizeBytes)}{completedAtLabel ? ` · ${completedAtLabel}` : ""}
              </div>
            </div>
          </Alert>
        )}
        {!isLoading && !hasReadyFile && exportInfo?.status === "EMPTY" && (
          <Alert severity="info">
            No export has been generated yet.
          </Alert>
        )}
        {!isLoading && exportInfo?.status === "MISSING" && (
          <Alert severity="warning">
            The last export file is no longer available. Please run a new export.
          </Alert>
        )}
      </div>
    </div>
  );
}
