import type { FocusEvent, ChangeEvent, MouseEvent } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  InputAdornment,
  Paper,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import RefreshIcon from "@mui/icons-material/Refresh";
import OpenInBrowserIcon from "@mui/icons-material/OpenInBrowser";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-shell";
import huntlyIcon from "../../src-tauri/icons/favicon-128x128.png";

const GITHUB_RELEASES_URL = "https://github.com/lcomplete/huntly/releases";

type ServerInfo = {
  jar_version: string | null;
  java_version: string | null;
  jar_path: string | null;
  java_path: string | null;
};

interface ServerTabProps {
  serverBundleAvailable: boolean | undefined;
  isServerRunning: boolean | undefined;
  isServerStarting: boolean;
  serverError: string | null;
  serverInfo: ServerInfo | null;
  formSettings: {
    values: {
      port: number;
      listen_public: boolean;
    };
    touched: {
      port?: boolean;
    };
    errors: {
      port?: string;
    };
    handleChange: (event: ChangeEvent<HTMLInputElement>) => void;
  };
  onStartServer: () => void;
  onStopServer: () => void;
  onRestartServer: () => void;
  onPortBlur: (event: FocusEvent<HTMLInputElement>) => void;
  onListenPublicChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

export default function ServerTab({
  serverBundleAvailable,
  isServerRunning,
  isServerStarting,
  serverError,
  serverInfo,
  formSettings,
  onStartServer,
  onStopServer,
  onRestartServer,
  onPortBlur,
  onListenPublicChange,
}: ServerTabProps) {
  const serverStatus =
    serverBundleAvailable === false
      ? "Unavailable"
      : isServerStarting
      ? "Starting"
      : isServerRunning
      ? "Running"
      : isServerRunning === false
      ? "Stopped"
      : "Checking";
  const serverUrl = `http://localhost:${formSettings.values.port}`;
  const hasLocalServer = serverBundleAvailable === true;
  const isLocalServerUnavailable = serverBundleAvailable === false;
  const canManageServer = hasLocalServer;
  const serverInfoFallback = "N/A";
  const serverSubtitle = "Manage the Huntly server running on this machine";
  const handleOpenReleases = (event?: MouseEvent<HTMLElement>) => {
    event?.preventDefault();
    void open(GITHUB_RELEASES_URL);
  };

  return (
    <Paper
      className={"max-w-[880px] mx-auto my-8 px-8 pb-10 page-shell reveal reveal-1"}
      elevation={0}
    >
      {/* Header */}
      <Box className="flex flex-col items-center text-center gap-3 pt-8 pb-6">
        <Box
          sx={{
            width: 64,
            height: 64,
            borderRadius: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: "rgba(15, 118, 110, 0.12)",
            boxShadow: "0 12px 30px rgba(15, 118, 110, 0.2)",
          }}
        >
          <Box
            component="img"
            src={huntlyIcon}
            alt="Huntly"
            sx={{ width: 40, height: 40 }}
          />
        </Box>
        <Box>
          <Typography variant="h4" fontWeight={700} className="hero-title">
            Local Server
          </Typography>
          {!isLocalServerUnavailable && (
            <Typography
              variant="body2"
              color="text.secondary"
              className="hero-sub"
            >
              {serverSubtitle}
            </Typography>
          )}
        </Box>
      </Box>

      {isLocalServerUnavailable ? (
        <Box className="reveal reveal-2" sx={{ mb: 4 }}>
          <Box
            sx={{
              borderRadius: 3,
              border: "1px solid var(--border)",
              bgcolor: "rgba(15, 118, 110, 0.08)",
              p: { xs: 3, sm: 4 },
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
            }}
          >
            <Typography variant="body2" color="text.secondary">
              This build does not include the local server.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              If you need it, download a server-enabled build from{" "}
              <Typography
                component="a"
                href={GITHUB_RELEASES_URL}
                onClick={(event) => handleOpenReleases(event)}
                variant="body2"
                sx={{
                  color: "var(--accent-strong)",
                  textDecoration: "underline",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                GitHub Releases
              </Typography>
              .
            </Typography>
          </Box>
        </Box>
      ) : (
        <Box className="reveal reveal-2" sx={{ mb: 4 }}>
          <Box
            sx={{
              display: "grid",
              gap: 3,
              gridTemplateColumns: { xs: "1fr", md: "1.1fr 0.9fr" },
            }}
          >
            <Box>
              <Typography className="kicker" sx={{ mb: 1 }}>
                Server Status
              </Typography>
              <Box className="status-line">
                {canManageServer && (
                  <Box
                    className="status-dot"
                    sx={{
                      bgcolor: isServerRunning
                        ? "var(--accent-strong)"
                        : isServerStarting
                        ? "#2563eb"
                        : "#94a3b8",
                      animation: isServerRunning
                        ? "pulse 2s infinite"
                        : isServerStarting
                        ? "pulse 1s infinite"
                        : "none",
                    }}
                  />
                )}
                <Typography
                  variant="h6"
                  fontWeight={700}
                  sx={{
                    color: isServerRunning
                      ? "var(--accent-strong)"
                      : isServerStarting
                      ? "#2563eb"
                      : "text.primary",
                  }}
                >
                  {serverStatus}
                </Typography>
              </Box>

              {isServerRunning && (
                <Box className="url-pill">
                  <Typography variant="caption" className="url-label">
                    URL
                  </Typography>
                  <Typography
                    component="button"
                    type="button"
                    onClick={() => invoke("open_server_url")}
                    variant="body2"
                    fontWeight={600}
                    className="url-link"
                  >
                    {serverUrl}
                  </Typography>
                </Box>
              )}

              {serverError && (
                <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                  {serverError}
                </Alert>
              )}

              <Box className="flex flex-wrap gap-2">
                {canManageServer ? (
                  <Button
                    variant="contained"
                    color={isServerRunning ? "error" : "primary"}
                    disabled={isServerStarting}
                    onClick={() => {
                      if (isServerRunning) {
                        onStopServer();
                      } else {
                        onStartServer();
                      }
                    }}
                    startIcon={
                      isServerStarting ? (
                        <CircularProgress size={16} color="inherit" />
                      ) : isServerRunning ? (
                        <StopIcon />
                      ) : (
                        <PlayArrowIcon />
                      )
                    }
                    sx={{ minWidth: 140 }}
                  >
                    {isServerStarting
                      ? "Starting..."
                      : isServerRunning
                      ? "Stop Server"
                      : "Start Server"}
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="contained"
                      disabled
                      startIcon={<PlayArrowIcon />}
                      sx={{
                        minWidth: 140,
                        "&.Mui-disabled": {
                          color: "rgba(31, 42, 42, 0.55)",
                          backgroundColor: "rgba(216, 225, 220, 0.75)",
                          boxShadow: "none",
                        },
                      }}
                    >
                      Start Server
                    </Button>
                    <Button
                      variant="outlined"
                      disabled
                      startIcon={<RefreshIcon />}
                    >
                      Restart
                    </Button>
                  </>
                )}
                {canManageServer && isServerRunning && (
                  <Button
                    variant="outlined"
                    onClick={() => onRestartServer()}
                    disabled={isServerStarting}
                    startIcon={<RefreshIcon />}
                  >
                    Restart
                  </Button>
                )}
                {isServerRunning && (
                  <Button
                    variant="outlined"
                    onClick={() => invoke("open_server_url")}
                    startIcon={<OpenInBrowserIcon />}
                  >
                    Open in Browser
                  </Button>
                )}
              </Box>
            </Box>

            <Box className="panel-stack">
              <Box className="section-card">
                <Typography className="kicker" sx={{ mb: 1 }}>
                  Server Settings
                </Typography>
                {!canManageServer && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 2 }}
                  >
                    Local server settings are disabled in this build.
                  </Typography>
                )}
                <div className="setting-row">
                  <div className="flex-1">
                    <div className="setting-title">Server Port</div>
                    <div className="setting-sub">Port 80-65535.</div>
                  </div>
                  <TextField
                    id="port"
                    placeholder="31234"
                    value={formSettings.values.port}
                    onChange={formSettings.handleChange}
                    onBlur={onPortBlur}
                    error={
                      formSettings.touched.port &&
                      Boolean(formSettings.errors.port)
                    }
                    helperText={
                      formSettings.touched.port && formSettings.errors.port
                        ? formSettings.errors.port
                        : undefined
                    }
                    type="number"
                    size="small"
                    variant="outlined"
                    sx={{ width: 180 }}
                    disabled={!canManageServer}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">:</InputAdornment>
                      ),
                    }}
                    inputProps={{ "aria-label": "Server Port" }}
                  />
                </div>
                <div className="setting-row">
                  <div className="flex-1">
                    <div className="setting-title">Listen on public network</div>
                    <div className="setting-sub">
                      Allow access from your local network.
                    </div>
                  </div>
                  <Switch
                    checked={!!formSettings.values.listen_public}
                    name={"listen_public"}
                    onChange={onListenPublicChange}
                    disabled={!canManageServer}
                  />
                </div>
              </Box>

              <Box className="section-card">
                <Typography className="kicker" sx={{ mb: 1 }}>
                  Server Info
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                    <Typography variant="body2" color="text.secondary">
                      Java Version
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {serverInfo?.java_version ?? serverInfoFallback}
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                    <Typography variant="body2" color="text.secondary">
                      JAR Version
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {serverInfo?.jar_version ?? serverInfoFallback}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>
      )}
    </Paper>
  );
}
