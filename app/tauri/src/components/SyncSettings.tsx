import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Button,
  CircularProgress,
  Divider,
  TextField,
  FormControlLabel,
  Box,
  Typography,
  Tooltip,
  Radio,
  RadioGroup,
  FormControl,
  Snackbar,
  Alert,
} from "@mui/material";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import SyncIcon from "@mui/icons-material/Sync";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import {
  SyncSettings as SyncSettingsType,
  SyncState,
  SyncResult,
} from "../types/sync";

interface Props {
  readonly allowLocalServer?: boolean;
  readonly onClose?: () => void;
}

const REALTIME_INTERVAL_SECONDS = 10;

function isLocalServerUrl(url: string, localUrl: string) {
  const trimmed = url.trim();
  // Only consider it a "local server" if it exactly matches the Tauri embedded server URL
  // This allows users to connect to other localhost services (e.g., http://localhost:3000)
  return trimmed === localUrl;
}

function normalizeServerUrl(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    const pathname = url.pathname.replace(/\/$/, "");
    return `${url.origin}${pathname}`;
  } catch (_e) {
    return trimmed.replace(/\/$/, "");
  }
}

function shouldResetSyncCursor(
  next: SyncSettingsType,
  prev: SyncSettingsType
) {
  const nextServer = normalizeServerUrl(next.server_url);
  const prevServer = normalizeServerUrl(prev.server_url);
  return next.export_folder !== prev.export_folder || nextServer !== prevServer;
}

function applySyncCursorReset(
  next: SyncSettingsType,
  prev: SyncSettingsType
) {
  if (shouldResetSyncCursor(next, prev)) {
    return { ...next, last_sync_at: null };
  }
  return next;
}

export default function SyncSettings({
  allowLocalServer = true,
  onClose: _onClose,
}: Props) {
  const [settings, setSettings] = useState<SyncSettingsType>({
    server_url: "",
    export_folder: "",
    sync_enabled: false,
    sync_interval_seconds: REALTIME_INTERVAL_SECONDS,
    last_sync_at: null,
  });

  const [syncState, setSyncState] = useState<SyncState>({
    is_syncing: false,
    last_sync_status: null,
    last_sync_error: null,
    synced_count: 0,
    logs: [],
  });

  const [localPort, setLocalPort] = useState<number>(31234);
  const localServerUrl = `http://localhost:${localPort}`;
  const [serverMode, setServerMode] = useState<"local" | "remote">(
    allowLocalServer ? "local" : "remote"
  );
  const lastRemoteUrlRef = useRef<string>("");
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const backgroundConfigRef = useRef<{
    server_url: string;
    export_folder: string;
  } | null>(null);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [serverConnected, setServerConnected] = useState<boolean | null>(null);
  const [toast, setToast] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "info" | "warning" | "error";
  }>({ open: false, message: "", severity: "info" });

  // Device Authorization Grant state
  const [deviceAuth, setDeviceAuth] = useState<{
    userCode: string;
    deviceCode: string;
    expiresAt: number;
    isPolling: boolean;
  } | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function showToast(
    message: string,
    severity: "success" | "info" | "warning" | "error" = "info"
  ) {
    setToast({ open: true, message, severity });
  }

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const init = async () => {
      const port = await loadAppPort();
      setLocalPort(port);
      await loadSettings(port);
      await loadSyncState();
    };
    init();
  }, []);

  // Track whether we're in the middle of user input to avoid resetting URL
  const isUserInputRef = useRef(false);

  useEffect(() => {
    // Skip if user is actively typing/pasting
    if (isUserInputRef.current) return;
    if (!allowLocalServer) {
      if (serverMode !== "remote") {
        setServerMode("remote");
        setIsLoggedIn(false);
      }
    }
  }, [allowLocalServer, localServerUrl, serverMode, settings.server_url]);



  useEffect(() => {
    if (!settings.sync_enabled) return;
    maybeStartBackgroundSync();
  }, [
    settings.sync_enabled,
    settings.server_url,
    settings.export_folder,
    settings.last_sync_at,
  ]);

  useEffect(() => {
    if (settings.sync_enabled) return;
    invoke("stop_background_sync").catch(() => {});
    backgroundConfigRef.current = null;
  }, [settings.sync_enabled]);

  // Periodically refresh sync state when sync is enabled
  useEffect(() => {
    if (!settings.sync_enabled) return;

    const interval = setInterval(() => {
      loadSyncState();
    }, 3000); // Refresh every 3 seconds

    return () => clearInterval(interval);
  }, [settings.sync_enabled]);

  async function loadAppPort(): Promise<number> {
    try {
      const raw = await invoke<string>("read_settings");
      if (raw) {
        const parsed = JSON.parse(raw) as { port?: number };
        return parsed.port ?? 31234;
      }
    } catch (e) {
      console.warn("Failed to read app settings:", e);
    }
    return 31234;
  }

  async function loadSettings(appPort: number) {
    try {
      const result = await invoke<SyncSettingsType>("read_sync_settings");
      const localUrl = `http://localhost:${appPort}`;
      const mode = allowLocalServer
        ? !result.server_url || isLocalServerUrl(result.server_url, localUrl)
          ? "local"
          : "remote"
        : "remote";

      setServerMode(mode);

      // Initialize lastRemoteUrlRef from persisted remote_server_url or current server_url
      if (result.remote_server_url) {
        lastRemoteUrlRef.current = result.remote_server_url;
      } else if (mode === "remote" && result.server_url) {
        lastRemoteUrlRef.current = result.server_url;
      }

      let normalized = result;
      if (mode === "local" && result.server_url !== localUrl) {
        normalized = { ...result, server_url: localUrl };
      }
      if (!allowLocalServer && isLocalServerUrl(result.server_url, localUrl)) {
        normalized = { ...result, server_url: "" };
      }

      setSettings({
        ...normalized,
        sync_interval_seconds: REALTIME_INTERVAL_SECONDS,
      });

      if (normalized.server_url) {
        await refreshConnectionAndAuth(normalized.server_url, mode);
      }

      if (normalized !== result) {
        await saveSettings(normalized, false);
      }
    } catch (e) {
      console.error("Failed to load settings:", e);
    }
  }

  async function loadSyncState() {
    try {
      const state = await invoke<SyncState>("get_sync_state");
      setSyncState(state);
      // Auto-scroll logs to bottom
      setTimeout(() => {
        if (logsContainerRef.current) {
          logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
        }
      }, 50);
    } catch (e) {
      console.error("Failed to load sync state:", e);
    }
  }

  async function refreshConnectionAndAuth(serverUrl: string, _mode?: "local" | "remote") {
    await checkServerConnection(serverUrl);
    // Both local and remote servers use the same authorization flow
    await checkSyncStatus(serverUrl);
  }

  async function checkServerConnection(serverUrl: string): Promise<boolean> {
    try {
      const connected = await invoke<boolean>("check_server_connection", {
        serverUrl,
      });
      setServerConnected(connected);
      return connected;
    } catch {
      setServerConnected(false);
      return false;
    }
  }

  async function checkSyncStatus(serverUrl: string) {
    try {
      const token = await invoke<string | null>("get_sync_token", { serverUrl });
      if (!token) return setIsLoggedIn(false);
      const isValid = await invoke<boolean>("verify_sync_token", { serverUrl, token });
      setIsLoggedIn(isValid);
    } catch (_e) {
      setIsLoggedIn(false);
    }
  }

  async function maybeStartBackgroundSync() {
    if (!settings.server_url || !settings.export_folder) return;
    const currentConfig = {
      server_url: settings.server_url,
      export_folder: settings.export_folder,
    };
    const prevConfig = backgroundConfigRef.current;
    const configChanged =
      prevConfig &&
      (prevConfig.server_url !== currentConfig.server_url ||
        prevConfig.export_folder !== currentConfig.export_folder);
    if (configChanged) {
      await invoke("stop_background_sync").catch(() => {});
      backgroundConfigRef.current = null;
    }
    try {
      await invoke("start_background_sync", {
        serverUrl: settings.server_url,
        token: "",
        exportFolder: settings.export_folder,
        intervalSeconds: REALTIME_INTERVAL_SECONDS,
        initialLastSyncAt: settings.last_sync_at,
      });
      backgroundConfigRef.current = currentConfig;
    } catch (e: any) {
      const errMsg = e?.toString() || "";
      // Ignore "already running" errors, but show other errors
      if (!errMsg.includes("already running")) {
        console.error("Background sync error:", e);
        showToast(`Sync error: ${errMsg}`, "error");
      }
    }
  }

  async function handleSelectFolder() {
    try {
      // Use Rust-side folder picker to properly handle macOS security-scoped bookmarks
      const folder = await invoke<string | null>("select_export_folder");

      if (folder) {
        const newSettings = applySyncCursorReset(
          { ...settings, export_folder: folder },
          settings
        );
        setSettings(newSettings);
        await saveSettings(newSettings);
      }
    } catch (e: any) {
      showToast(
        `Can't write to this folder. On macOS, folders like Desktop/Documents/Downloads require permission for Huntly (System Settings → Privacy & Security → Files and Folders). Details: ${e}`,
        "error"
      );
    }
  }

  async function handleOpenExportFolder() {
    if (!settings.export_folder) {
      showToast("Please choose an export folder first", "warning");
      return;
    }
    try {
      await invoke("open_url", { url: settings.export_folder });
    } catch (e: any) {
      showToast(e?.toString() ?? "Failed to open folder", "error");
    }
  }

  async function saveSettings(
    newSettings: SyncSettingsType,
    showMessage = true
  ) {
    try {
      await invoke("save_sync_settings", { settings: newSettings });
      if (showMessage) showToast("Settings saved", "success");
    } catch (e: any) {
      showToast(e.toString(), "error");
    }
  }

  async function handleServerModeChange(mode: "local" | "remote") {
    if (!allowLocalServer && mode === "local") {
      return;
    }
    if (mode === serverMode) return;
    const localUrl = localServerUrl;

    let newSettings = { ...settings };
    if (mode === "local") {
      // Save current remote URL before switching to local
      if (settings.server_url && !isLocalServerUrl(settings.server_url, localUrl)) {
        lastRemoteUrlRef.current = settings.server_url;
        newSettings.remote_server_url = settings.server_url;
      }
      newSettings.server_url = localUrl;
    } else {
      // Restore remote URL from persisted setting or ref
      const remoteUrl = settings.remote_server_url || lastRemoteUrlRef.current || "";
      newSettings.server_url = remoteUrl;
      if (remoteUrl) {
        lastRemoteUrlRef.current = remoteUrl;
      }
    }

    setServerMode(mode);
    newSettings = applySyncCursorReset(newSettings, settings);
    setSettings(newSettings);
    setServerConnected(null);
    // Both local and remote use the same authorization flow - let refreshConnectionAndAuth check the token

    await saveSettings(newSettings, false);
    if (newSettings.server_url) {
      await refreshConnectionAndAuth(newSettings.server_url, mode);
    }
  }

  async function handleServerUrlChange(url: string) {
    isUserInputRef.current = true;
    const newSettings = { ...settings, server_url: url };
    setSettings(newSettings);
    setServerConnected(null);
    setIsLoggedIn(false);
  }

  async function handleServerUrlBlur(value: string) {
    isUserInputRef.current = false;
    const normalized = normalizeServerUrl(value);
    if (!normalized) {
      return;
    }

    // When in remote mode, also persist the remote_server_url
    let newSettings = applySyncCursorReset(
      { ...settings, server_url: normalized },
      settings
    );
    if (serverMode === "remote") {
      newSettings.remote_server_url = normalized;
      lastRemoteUrlRef.current = normalized;
    }

    if (
      newSettings.server_url !== settings.server_url ||
      newSettings.last_sync_at !== settings.last_sync_at ||
      newSettings.remote_server_url !== settings.remote_server_url
    ) {
      setSettings(newSettings);
    }
    await saveSettings(newSettings);
    await refreshConnectionAndAuth(normalized);
  }

  async function handleStartDeviceAuth() {
    if (!settings.server_url) {
      showToast("Please configure server URL first", "warning");
      return;
    }

    setAuthError(null); // Clear previous error
    const base = settings.server_url.trim().replace(/\/$/, "");

    try {
      // Step 1: Request device code from server via Tauri command
      const deviceCodeResult = await invoke<{
        device_code: string;
        user_code: string;
        expires_in: number;
        interval: number;
      }>("request_device_code", { serverUrl: base });

      const { device_code, user_code, expires_in, interval } = deviceCodeResult;
      const expiresAt = Date.now() + expires_in * 1000;
      const authorizeUrl = `${base}/desktop-authorize?code=${encodeURIComponent(
        user_code
      )}`;

      setDeviceAuth({
        userCode: user_code,
        deviceCode: device_code,
        expiresAt,
        isPolling: true,
      });

      // Open authorization page in browser with prefilled code
      await invoke("open_url", { url: authorizeUrl });

      // Step 2: Start polling for token
      const pollInterval = (interval || 5) * 1000;
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }

      pollingIntervalRef.current = globalThis.setInterval(async () => {
        if (Date.now() > expiresAt) {
          // Code expired
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          setDeviceAuth(null);
          showToast("Authorization code expired. Please try again.", "error");
          return;
        }

        try {
          const tokenResult = await invoke<{
            sync_token: string;
            server_url: string;
          } | null>("poll_device_token", {
            serverUrl: base,
            deviceCode: device_code,
          });

          if (tokenResult) {
            // Success! Save the token
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }

            const { sync_token } = tokenResult;
            // Always use the configured server URL (base), not the one from server response
            // This ensures consistency between save and lookup
            await invoke("save_sync_token", {
              serverUrl: base,
              token: sync_token,
            });

            setDeviceAuth(null);
            setIsLoggedIn(true);
            showToast("Connected successfully!", "success");

            if (settings.sync_enabled) {
              await maybeStartBackgroundSync();
            }
          } else {
            // Authorization pending - continue polling
            console.log("[Device Auth] Authorization pending...");
          }
        } catch (e) {
          console.error("[Device Auth] Polling error:", e);
        }
      }, pollInterval);
    } catch (e: unknown) {
      console.error("[handleStartDeviceAuth] Error:", e);
      // Show detailed error message for easier debugging
      let errorMsg = "Failed to start authorization";
      if (e instanceof Error) {
        errorMsg = e.message;
      } else if (typeof e === "string") {
        errorMsg = e;
      } else if (e && typeof e === "object") {
        errorMsg = JSON.stringify(e);
      }
      setAuthError(errorMsg);
      showToast(`Authorization error: ${errorMsg}`, "error");
    }
  }

  function handleCancelDeviceAuth() {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setDeviceAuth(null);
  }

  async function handleOpenHuntly() {
    if (!settings.server_url) return;
    await invoke("open_url", { url: settings.server_url });
  }

  async function handleClearToken() {
    if (!settings.server_url) return;
    try {
      await invoke("delete_sync_token", { serverUrl: settings.server_url });
      setIsLoggedIn(false);
      showToast("Disconnected", "success");
    } catch (e: any) {
      showToast(e.toString(), "error");
    }
  }

  async function handleSyncNow(_forceFullSync = false) {
    if (!settings.server_url || !settings.export_folder) {
      showToast("Please configure server and export folder first", "warning");
      return;
    }

    setIsLoading(true);

    try {
      const result = await invoke<SyncResult>("sync_library_to_markdown", {
        serverUrl: settings.server_url,
        token: "",
        exportFolder: settings.export_folder,
        lastSyncAt: _forceFullSync ? null : settings.last_sync_at,
      });

      await loadSettings(localPort);

      const syncType = result.is_incremental ? "Incremental sync" : "Full sync";
      const msg = `${syncType}: ${result.synced_count} updated, ${result.skipped_count} skipped`;
      showToast(msg, "success");

      if (result.errors.length > 0) {
        showToast(`Completed with ${result.errors.length} errors`, "warning");
      }

      loadSyncState();
    } catch (e: any) {
      showToast(e.toString(), "error");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleToggleRealtimeSync() {
    const enabled = !settings.sync_enabled;
    const newSettings = {
      ...settings,
      sync_enabled: enabled,
      sync_interval_seconds: REALTIME_INTERVAL_SECONDS,
    };
    setSettings(newSettings);
    await saveSettings(newSettings, false);

    if (enabled) {
      // Kick off one sync immediately, then background sync.
      await handleSyncNow(false);
      await maybeStartBackgroundSync();
      showToast("Real‑time sync enabled", "success");
    } else {
      await invoke("stop_background_sync").catch(() => {});
      showToast("Sync paused", "info");
    }
  }

  return (
    <Box className="p-4">
      <Typography variant="h6" className="mb-4">
        Markdown Sync
      </Typography>

      <Snackbar
        open={toast.open}
        autoHideDuration={toast.severity === "error" ? 8000 : 3500}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        sx={{
          position: "fixed",
          bottom: 24,
          left: "50%",
          transform: "translateX(-50%)",
        }}
      >
        <Alert
          severity={toast.severity}
          onClose={() => setToast((t) => ({ ...t, open: false }))}
          variant="filled"
          sx={{ width: "100%", maxWidth: 500 }}
        >
          {toast.message}
        </Alert>
      </Snackbar>

      <Snackbar
        open={Boolean(syncState.last_sync_error)}
        onClose={() =>
          setSyncState((prev) => ({ ...prev, last_sync_error: null }))
        }
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        sx={{ bottom: 88 }}
      >
        <Alert
          severity="warning"
          onClose={() =>
            setSyncState((prev) => ({ ...prev, last_sync_error: null }))
          }
          variant="filled"
          sx={{ width: "100%", maxWidth: 520 }}
        >
          {syncState.last_sync_error}
        </Alert>
      </Snackbar>

      {/* Export Folder */}
      <Box className="section-card export-card mb-4">
        <div className="setting-row">
          <Box className="flex items-center gap-3 flex-1 min-w-0">
            <Box className="export-icon">
              <FolderOpenIcon fontSize="medium" />
            </Box>
            <Typography variant="subtitle1" className="font-bold">
              Export Folder
            </Typography>
          </Box>
          <Box className="flex gap-2 flex-shrink-0">
            <Button
              variant="outlined"
              startIcon={<FolderOpenIcon />}
              onClick={handleSelectFolder}
              sx={{
                color: "#1d4ed8",
                borderColor: "rgba(37, 99, 235, 0.6)",
                "&:hover": {
                  borderColor: "rgba(37, 99, 235, 0.9)",
                  backgroundColor: "rgba(37, 99, 235, 0.08)",
                },
              }}
            >
              {settings.export_folder ? "Select folder" : "Choose folder"}
            </Button>
            {settings.export_folder && (
              <Button
                variant="outlined"
                startIcon={<OpenInNewIcon />}
                onClick={handleOpenExportFolder}
              >
                Open folder
              </Button>
            )}
          </Box>
        </div>
        {settings.export_folder && (
          <Box className="export-path">
            <Typography variant="body2" className="export-path-text">
              {settings.export_folder}
            </Typography>
          </Box>
        )}
      </Box>

      <Divider className="my-4" />

      {/* Server Configuration */}
      <Box className="mb-4">
        <Typography variant="subtitle1" className="font-bold mb-2">
          Server
        </Typography>

        <FormControl component="fieldset" className="mb-2">
          <RadioGroup
            row
            value={serverMode}
            onChange={(e) =>
              handleServerModeChange(e.target.value as "local" | "remote")
            }
          >
            <FormControlLabel
              value="local"
              control={<Radio size="small" />}
              label={
                allowLocalServer
                  ? "Local server"
                  : "Local server"
              }
              disabled={!allowLocalServer}
            />
            <FormControlLabel
              value="remote"
              control={<Radio size="small" />}
              label="Remote server"
            />
          </RadioGroup>
        </FormControl>

        <Box className="flex items-center gap-2">
          <TextField
            fullWidth
            size="small"
            label={
              allowLocalServer
                ? serverMode === "local"
                  ? "Local server URL"
                  : "Remote server URL"
                : "Server URL"
            }
            placeholder="https://your-huntly.example.com"
            value={
              serverMode === "local" ? localServerUrl : settings.server_url
            }
            onChange={(e) =>
              serverMode === "remote" && handleServerUrlChange(e.target.value)
            }
            onBlur={(event) =>
              serverMode === "remote" && handleServerUrlBlur(event.target.value)
            }
            InputProps={{ readOnly: allowLocalServer && serverMode === "local" }}
          />
          {serverConnected === true && (
            <Tooltip title="Connected">
              <CheckCircleIcon color="success" />
            </Tooltip>
          )}
          {serverConnected === false && (
            <Tooltip title="Connection failed">
              <ErrorIcon color="error" />
            </Tooltip>
          )}
        </Box>
      </Box>

      <Divider className="my-4" />

      {/* Authentication */}
      <Box className="mb-4">
        {!isLoggedIn && !deviceAuth && (
          <Alert severity="info" className="mb-2">
            {serverMode === "local"
              ? "Connect to your local Huntly server to enable sync."
              : "Connect to your remote Huntly server to enable sync."}
          </Alert>
        )}

        {isLoggedIn ? (
          <Box className="flex items-center gap-2">
            <Alert severity="success" className="flex-1">
              Connected for sync
            </Alert>
            <Button
              variant="outlined"
              startIcon={<OpenInNewIcon />}
              onClick={handleOpenHuntly}
            >
              Open Huntly
            </Button>
            <Button color="error" variant="text" onClick={handleClearToken}>
              Disconnect
            </Button>
          </Box>
        ) : deviceAuth ? (
          <Box className="flex flex-col gap-3">
            <Alert severity="info">
              Please complete the authorization in your browser.
            </Alert>
            <Box className="flex justify-center">
              <Typography
                variant="h4"
                className="font-mono tracking-widest bg-gray-100 dark:bg-gray-800 px-6 py-3 rounded-lg"
                sx={{ letterSpacing: "0.3em", fontWeight: "bold" }}
              >
                {deviceAuth.userCode}
              </Typography>
            </Box>
            <Box className="flex items-center justify-center gap-2">
              <CircularProgress size={16} />
              <Typography variant="body2" color="textSecondary">
                Waiting for authorization...
              </Typography>
            </Box>
            <Box className="flex justify-center">
              <Button
                variant="text"
                color="error"
                onClick={handleCancelDeviceAuth}
              >
                Cancel
              </Button>
            </Box>
          </Box>
        ) : (
          <Box className="flex flex-col gap-2">
            {authError && (
              <Alert
                severity="error"
                className="mb-2"
                onClose={() => setAuthError(null)}
                sx={{
                  wordBreak: "break-word",
                  "& .MuiAlert-message": { whiteSpace: "pre-wrap" }
                }}
              >
                <Typography variant="body2" component="div">
                  <strong>Connection failed:</strong>
                  <br />
                  {authError}
                </Typography>
              </Alert>
            )}
            <Button
              variant="contained"
              startIcon={<OpenInNewIcon />}
              onClick={handleStartDeviceAuth}
              disabled={!settings.server_url}
              sx={{
                "&.Mui-disabled": {
                  color: "rgba(255, 255, 255, 0.85)",
                  backgroundColor: "rgba(15, 118, 110, 0.45)",
                },
              }}
            >
              {serverMode === "local" ? "Connect local account" : "Connect remote account"}
            </Button>
            <Typography variant="body2" color="textSecondary">
              A code will be shown here. Enter it in your browser to connect.
            </Typography>
          </Box>
        )}
      </Box>

      <Divider className="my-4" />

      {/* Sync Status */}
      <Box className="mb-4">
        <Typography variant="subtitle1" className="font-bold mb-2">
          Sync Status
        </Typography>
        <Typography variant="body2" color="textSecondary">
          {syncState.is_syncing || isLoading
            ? "Status: syncing…"
            : settings.sync_enabled
            ? "Status: real‑time sync on"
            : "Status: idle"}
        </Typography>
        {syncState.last_sync_status && (
          <Typography variant="body2" color="textSecondary">
            {syncState.last_sync_status}
          </Typography>
        )}
        {settings.last_sync_at && (
          <Typography variant="body2" color="textSecondary">
            Last sync: {new Date(settings.last_sync_at).toLocaleString()}
          </Typography>
        )}
        <Box className="flex gap-2 mt-2">
          <Button
            variant="contained"
            startIcon={
              isLoading || syncState.is_syncing ? (
                <CircularProgress size={16} />
              ) : (
                <SyncIcon />
              )
            }
            onClick={handleToggleRealtimeSync}
            disabled={
              isLoading ||
              syncState.is_syncing ||
              !settings.export_folder ||
              !settings.server_url ||
              (serverMode === "remote" && !isLoggedIn)
            }
            sx={{
              "&.Mui-disabled": {
                color: "rgba(255, 255, 255, 0.85)",
                backgroundColor: "rgba(15, 118, 110, 0.45)",
              },
            }}
          >
            {isLoading || syncState.is_syncing
              ? "Syncing..."
              : settings.sync_enabled
              ? "Pause Sync"
              : "Start Sync"}
          </Button>
        </Box>
      </Box>

      {/* Sync Logs */}
      <Box className="mb-2">
        <Box className="flex items-center justify-between mb-2">
          <Typography variant="subtitle1" className="font-bold">
            Sync Logs
          </Typography>
          <Button
            size="small"
            onClick={() => loadSyncState()}
            startIcon={<SyncIcon />}
          >
            Refresh
          </Button>
        </Box>
        <Box
          ref={logsContainerRef}
          className="border rounded-md p-2 bg-white max-h-[180px] overflow-auto"
        >
          {syncState.logs.length === 0 ? (
            <Typography variant="body2" color="textSecondary">
              No logs yet.
            </Typography>
          ) : (
            <Box component="pre" className="text-xs leading-5 m-0 whitespace-pre-wrap">
              {syncState.logs.join("\n")}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
