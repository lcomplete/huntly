import { useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Switch,
  Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import GitHubIcon from "@mui/icons-material/GitHub";
import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { open } from "@tauri-apps/plugin-shell";

const GITHUB_URL = "https://github.com/lcomplete/huntly";

type UpdateState = {
  checking: boolean;
  installing: boolean;
  available: boolean;
  version: string | null;
  currentVersion: string | null;
  notes: string | null;
  date: string | null;
  lastCheckedAt: string | null;
  error: string | null;
  installed: boolean;
};

interface SettingsTabProps {
  formSettings: {
    values: {
      auto_start_up: boolean;
      auto_update: boolean;
      show_tray_icon?: boolean;
      show_dock_icon?: boolean;
    };
  };
  updateState: UpdateState;
  onAutoStartUpChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onShowTrayIconChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onShowDockIconChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onAutoUpdateChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onCheckForUpdates: () => void;
  onInstallUpdate: () => void;
}

export default function SettingsTab({
  formSettings,
  updateState,
  onAutoStartUpChange,
  onShowTrayIconChange,
  onShowDockIconChange,
  onAutoUpdateChange,
  onCheckForUpdates,
  onInstallUpdate,
}: SettingsTabProps) {
  const [appVersion, setAppVersion] = useState<string | null>(null);

  useEffect(() => {
    getVersion().then(setAppVersion).catch(() => setAppVersion(null));
  }, []);

  return (
    <Paper
      className={"max-w-[760px] mx-auto my-6 p-8 page-shell reveal reveal-2"}
      elevation={0}
    >
      <Box className="section-head">
        <Typography className="kicker">Settings</Typography>
        <Typography variant="h5" fontWeight={700}>
          App Preferences
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Changes save automatically.
        </Typography>
      </Box>

      <Box className="section-card">
        <Typography className="kicker" sx={{ mb: 1 }}>
          General
        </Typography>
        <div className="setting-row">
          <div className="flex-1">
            <div className="setting-title">Launch on Login</div>
            <div className="setting-sub">Open Huntly on system startup.</div>
          </div>
          <Switch
            checked={!!formSettings.values.auto_start_up}
            name={"auto_start_up"}
            onChange={onAutoStartUpChange}
          />
        </div>
        <div className="setting-row">
          <div className="flex-1">
            <div className="setting-title">Show Tray Icon</div>
            <div className="setting-sub">
              Display the Huntly icon in the system tray (menu bar on macOS).
            </div>
          </div>
          <Switch
            checked={formSettings.values.show_tray_icon ?? true}
            name={"show_tray_icon"}
            onChange={onShowTrayIconChange}
          />
        </div>
        <div className="setting-row">
          <div className="flex-1">
            <div className="setting-title">Show Dock Icon</div>
            <div className="setting-sub">
              Display the Huntly icon in the Dock (macOS only).
            </div>
          </div>
          <Switch
            checked={formSettings.values.show_dock_icon ?? true}
            name={"show_dock_icon"}
            onChange={onShowDockIconChange}
          />
        </div>
      </Box>

      <Box className="section-card mt-4">
        <Typography className="kicker" sx={{ mb: 1 }}>
          Updates
        </Typography>
        <div className="setting-row">
          <div className="flex-1">
            <div className="setting-title">Check for Updates</div>
            <div className="setting-sub">
              Manually check for new versions of Huntly.
            </div>
          </div>
          <Box className="flex flex-wrap gap-2">
            <Button
              variant="outlined"
              onClick={onCheckForUpdates}
              disabled={updateState.checking || updateState.installing}
              startIcon={
                updateState.checking ? (
                  <CircularProgress size={16} />
                ) : (
                  <RefreshIcon />
                )
              }
            >
              {updateState.checking ? "Checking..." : "Check now"}
            </Button>
            {updateState.available && (
              <Button
                variant="contained"
                onClick={onInstallUpdate}
                disabled={updateState.installing}
                startIcon={
                  updateState.installing ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : undefined
                }
              >
                {updateState.installing ? "Installing..." : "Download & Install"}
              </Button>
            )}
          </Box>
        </div>
        <div className="setting-row">
          <div className="flex-1">
            <div className="setting-title">Automatic Updates</div>
            <div className="setting-sub">
              Download and install updates automatically when available.
            </div>
          </div>
          <Switch
            checked={!!formSettings.values.auto_update}
            name={"auto_update"}
            onChange={onAutoUpdateChange}
          />
        </div>
        <Box sx={{ mt: 1 }}>
          {updateState.error && (
            <Alert severity="error" sx={{ borderRadius: 2 }}>
              {updateState.error}
            </Alert>
          )}
          {!updateState.error && updateState.available && (
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              Update available: v{updateState.version}
              {updateState.date ? ` (${updateState.date})` : ""}
            </Alert>
          )}
          {!updateState.error &&
            !updateState.available &&
            updateState.lastCheckedAt &&
            !updateState.checking && (
              <Typography variant="body2" color="text.secondary">
                You are up to date. Last checked{" "}
                {new Date(updateState.lastCheckedAt).toLocaleString()}.
              </Typography>
            )}
          {updateState.installed && (
            <Alert severity="success" sx={{ mt: 1, borderRadius: 2 }}>
              Update installed. Restart Huntly to finish.
            </Alert>
          )}
          {updateState.notes && updateState.available && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 1, whiteSpace: "pre-line" }}
            >
              {updateState.notes}
            </Typography>
          )}
        </Box>
      </Box>

      <Box className="section-card mt-4">
        <Typography className="kicker" sx={{ mb: 1 }}>
          Storage
        </Typography>
        <div className="setting-row">
          <div className="flex-1">
            <div className="setting-title">Data Directory</div>
            <div className="setting-sub">
              Access settings, database, and Lucene search index files.
            </div>
          </div>
          <Button
            variant="outlined"
            onClick={() => invoke("open_data_dir")}
            startIcon={<FolderOpenIcon />}
          >
            Open Data Directory
          </Button>
        </div>
      </Box>

      {/* About */}
      <Box
        sx={{
          mt: 6,
          pt: 3,
          borderTop: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 1,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <GitHubIcon sx={{ fontSize: 18, color: "text.secondary" }} />
          <Typography
            component="a"
            href={GITHUB_URL}
            onClick={(e) => {
              e.preventDefault();
              open(GITHUB_URL);
            }}
            variant="body2"
            sx={{
              color: "text.secondary",
              textDecoration: "none",
              cursor: "pointer",
              "&:hover": {
                color: "var(--accent-strong)",
                textDecoration: "underline",
              },
            }}
          >
            lcomplete/huntly
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          Desktop Version: {appVersion ? `v${appVersion}` : "—"}
        </Typography>
      </Box>
    </Paper>
  );
}

