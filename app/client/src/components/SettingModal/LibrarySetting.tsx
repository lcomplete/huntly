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
import { useTranslation } from 'react-i18next';

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

function TabPanel(props: Readonly<TabPanelProps>) {
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
  const { t } = useTranslation(['settings', 'common']);
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
      console.error('Failed to load export status', error);
      enqueueSnackbar(t('settings:exportStatusLoadFailed'), {
        variant: "error",
        anchorOrigin: { vertical: "bottom", horizontal: "center" }
      });
    } finally {
      setIsLoading(false);
    }
  }, [enqueueSnackbar, t]);

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
    const fileName = exportInfo.fileName;
    const poll = async () => {
      try {
        const info = await fetchLibraryExportStatus(fileName);
        if (!isMounted) {
          return;
        }
        const previousStatus = lastStatusRef.current;
        lastStatusRef.current = info?.status;
        setExportInfo(info);
        if (previousStatus === "IN_PROGRESS" && info?.status === "READY") {
          enqueueSnackbar(t('settings:exportReadySnackbar'), {
            variant: "success",
            anchorOrigin: { vertical: "bottom", horizontal: "center" }
          });
        }
        if (previousStatus === "IN_PROGRESS" && info?.status === "FAILED") {
          enqueueSnackbar(t('settings:exportFailedRetry'), {
            variant: "error",
            anchorOrigin: { vertical: "bottom", horizontal: "center" }
          });
        }
      } catch (error) {
        console.error('Failed to refresh export status', error);
        if (isMounted) {
          enqueueSnackbar(t('settings:exportStatusRefreshFailed'), {
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
  }, [enqueueSnackbar, exportInfo?.fileName, isPreparing, t]);

  const handleExport = useCallback(async () => {
    try {
      const info = await startLibraryExport();
      setExportInfo(info);
      lastStatusRef.current = info?.status;
      enqueueSnackbar(t('settings:exportStarted'), {
        variant: "info",
        anchorOrigin: { vertical: "bottom", horizontal: "center" }
      });
    } catch (error) {
      console.error('Failed to start export', error);
      enqueueSnackbar(t('settings:exportStartFailed'), {
        variant: "error",
        anchorOrigin: { vertical: "bottom", horizontal: "center" }
      });
    }
  }, [enqueueSnackbar, t]);

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
        description={t('settings:libraryExportDesc')}
      >
        {t('settings:libraryExport')}
      </SettingSectionTitle>

      <div className="mt-4 flex items-center gap-3">
        <Button
          variant="contained"
          onClick={handleExport}
          disabled={isPreparing || isLoading}
        >
          {t('settings:exportLibraryBtn')}
        </Button>
        {isPreparing && (
          <Typography variant="body2" className="text-gray-600">
            {t('settings:preparingExport')}
          </Typography>
        )}
      </div>

      <div className="mt-4">
        {!isLoading && exportInfo?.status === "FAILED" && (
          <Alert severity="error">
            {exportInfo?.message || t('settings:exportFailedRetry')}
          </Alert>
        )}
        {!isLoading && exportInfo?.status === "IN_PROGRESS" && (
          <Alert severity="info">
            {t('settings:exportInProgressNotice')}
          </Alert>
        )}
        {!isLoading && hasReadyFile && exportInfo.fileName && (
          <Alert severity="success">
            <div className="flex flex-col gap-1">
              <div>{t('settings:exportReady')}</div>
              <div>
                <Link
                  href={getLibraryExportDownloadUrl(exportInfo.fileName)}
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
            {t('settings:exportEmpty')}
          </Alert>
        )}
        {!isLoading && exportInfo?.status === "MISSING" && (
          <Alert severity="warning">
            {t('settings:exportMissing')}
          </Alert>
        )}
      </div>
    </div>
  );
}

export default function LibrarySetting() {
  const [tabValue, setTabValue] = useState(0);
  const { t } = useTranslation(['settings', 'common']);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <div>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label={t('settings:librarySettings')}>
          <Tab icon={<DriveFileMoveIcon />} iconPosition="start" label={t('settings:batchOrganize')} {...a11yProps(0)} sx={{ minHeight: 48 }} />
          <Tab icon={<DownloadIcon />} iconPosition="start" label={t('common:export', 'Export')} {...a11yProps(1)} sx={{ minHeight: 48 }} />
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
