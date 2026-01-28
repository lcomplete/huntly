import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Box, Button, Link, Tab, Tabs, Typography } from "@mui/material";
import { useSnackbar } from "notistack";
import SettingSectionTitle from "./SettingSectionTitle";
import {
  fetchLatestLibraryExport,
  fetchLibraryExportStatus,
  getLibraryExportDownloadUrl,
  LibraryExportInfo,
  LibraryExportStatus,
  startLibraryExport
} from "../../api/libraryExport";
import BatchOrganizeSetting from "./BatchOrganizeSetting";
import DownloadIcon from '@mui/icons-material/Download';
import DriveFileMoveIcon from '@mui/icons-material/DriveFileMove';

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

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`library-tabpanel-${index}`}
      aria-labelledby={`library-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ pt: 2 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `library-tab-${index}`,
    'aria-controls': `library-tabpanel-${index}`,
  };
}

function ExportSetting() {
  const { enqueueSnackbar } = useSnackbar();
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
        anchorOrigin: { vertical: "bottom", horizontal: "center" }
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
            anchorOrigin: { vertical: "bottom", horizontal: "center" }
          });
        }
        if (previousStatus === "IN_PROGRESS" && info?.status === "FAILED") {
          enqueueSnackbar("Export failed. Please try again.", {
            variant: "error",
            anchorOrigin: { vertical: "bottom", horizontal: "center" }
          });
        }
      } catch (error) {
        if (isMounted) {
          enqueueSnackbar("Failed to refresh export status.", {
            variant: "warning",
            anchorOrigin: { vertical: "bottom", horizontal: "center" }
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
        anchorOrigin: { vertical: "bottom", horizontal: "center" }
      });
    } catch (error) {
      enqueueSnackbar("Failed to start export. Please try again.", {
        variant: "error",
        anchorOrigin: { vertical: "bottom", horizontal: "center" }
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
      <SettingSectionTitle
        first
        icon={DownloadIcon}
        description="Export your Library entries as Markdown files packaged in a ZIP archive. Files will be organized according to your Collection folder structure."
      >
        Library Export
      </SettingSectionTitle>

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

export default function LibrarySetting() {
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <div>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="library settings tabs">
          <Tab icon={<DriveFileMoveIcon />} iconPosition="start" label="Batch Organize" {...a11yProps(0)} sx={{ minHeight: 48 }} />
          <Tab icon={<DownloadIcon />} iconPosition="start" label="Export" {...a11yProps(1)} sx={{ minHeight: 48 }} />
        </Tabs>
      </Box>
      <TabPanel value={tabValue} index={0}>
        <BatchOrganizeSetting />
      </TabPanel>
      <TabPanel value={tabValue} index={1}>
        <ExportSetting />
      </TabPanel>
    </div>
  );
}
