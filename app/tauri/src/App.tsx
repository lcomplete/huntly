import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FocusEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";
import { isString, useFormik } from "formik";
import * as yup from "yup";
import {
  Tabs,
  Tab,
  Box,
} from "@mui/material";
import SettingsIcon from "@mui/icons-material/Settings";
import DnsIcon from "@mui/icons-material/Dns";
import { enable, isEnabled, disable } from "@tauri-apps/plugin-autostart";
import { check } from "@tauri-apps/plugin-updater";
import ServerTab from "./components/ServerTab";
import SettingsTab from "./components/SettingsTab";

type AppSettings = {
  port: number;
  listen_public: boolean;
  auto_start_up: boolean;
  auto_update: boolean;
  server_auto_update: boolean;
  show_tray_icon: boolean;
  show_dock_icon: boolean;
};

type ServerInfo = {
  jar_version: string | null;
  java_version: string | null;
  jar_path: string | null;
  java_path: string | null;
};

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

type ServerJarUpdateInfo = {
  current_version: string | null;
  latest_version: string | null;
  latest_tag: string | null;
  available: boolean;
  notes: string | null;
  date: string | null;
  asset_name: string | null;
  asset_size: number | null;
  release_url: string | null;
};

type ServerUpdateState = {
  checking: boolean;
  installing: boolean;
  available: boolean;
  latestVersion: string | null;
  currentVersion: string | null;
  latestTag: string | null;
  notes: string | null;
  date: string | null;
  assetName: string | null;
  assetSize: number | null;
  releaseUrl: string | null;
  lastCheckedAt: string | null;
  error: string | null;
  installed: boolean;
};

function App() {
  const defaultSettings: AppSettings = {
    port: 31234,
    listen_public: false,
    auto_start_up: false,
    auto_update: false,
    server_auto_update: false,
    show_tray_icon: true,
    show_dock_icon: true,
  };
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [serverBundleAvailable, setServerBundleAvailable] = useState<
    boolean | undefined
  >();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isServerRunning, setIsServerRunning] = useState<boolean | undefined>();
  const [isServerStarting, setIsServerStarting] = useState<boolean>(false);
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const timerRef = useRef<number>();
  const [activeTab, setActiveTab] = useState(0);
  const [updateState, setUpdateState] = useState<UpdateState>({
    checking: false,
    installing: false,
    available: false,
    version: null,
    currentVersion: null,
    notes: null,
    date: null,
    lastCheckedAt: null,
    error: null,
    installed: false,
  });
  const [serverUpdateState, setServerUpdateState] = useState<ServerUpdateState>({
    checking: false,
    installing: false,
    available: false,
    latestVersion: null,
    currentVersion: null,
    latestTag: null,
    notes: null,
    date: null,
    assetName: null,
    assetSize: null,
    releaseUrl: null,
    lastCheckedAt: null,
    error: null,
    installed: false,
  });
  const updateRef = useRef<Awaited<ReturnType<typeof check>> | null>(null);
  const autoUpdateTriggeredRef = useRef(false);
  const autoServerUpdateTriggeredRef = useRef(false);

  useEffect(() => {
    invoke<boolean>("has_server_jar")
      .then((result) => setServerBundleAvailable(!!result))
      .catch(() => setServerBundleAvailable(false));

    // Fetch server info (Java version, JAR version)
    invoke<ServerInfo>("get_server_info")
      .then((info) => setServerInfo(info))
      .catch(() => setServerInfo(null));
  }, []);

  useEffect(() => {
    invoke("read_settings").then(async (result) => {
      if (result && isString(result)) {
        const appSettings = {
          ...defaultSettings,
          ...(JSON.parse(result) as Partial<AppSettings>),
        };
        setSettings(appSettings);
        // Apply tray and dock icon visibility
        invoke("set_tray_visible", { visible: appSettings.show_tray_icon ?? true });
        invoke("set_dock_visible", { visible: appSettings.show_dock_icon ?? true });
        if (appSettings.auto_start_up && !await isEnabled()) {
          enable();
        }
        else if (!appSettings.auto_start_up && await isEnabled()) {
          disable();
        }
      }
    });
  }, []);

  useEffect(() => {
    if (!settings.auto_update) {
      autoUpdateTriggeredRef.current = false;
      return;
    }
    if (autoUpdateTriggeredRef.current) return;
    autoUpdateTriggeredRef.current = true;
    handleCheckForUpdates({ autoInstall: true });
  }, [settings.auto_update]);

  useEffect(() => {
    if (!settings.server_auto_update) {
      autoServerUpdateTriggeredRef.current = false;
      return;
    }
    if (autoServerUpdateTriggeredRef.current) return;
    autoServerUpdateTriggeredRef.current = true;
    handleCheckServerUpdate({ autoInstall: true });
  }, [settings.server_auto_update]);

  function startServer() {
    setServerError(null);
    invoke("start_server")
      .then((result) => {
        setIsServerStarting(true);
      })
      .catch((e) => {
        setIsServerStarting(false);
        setIsServerRunning(false);
        setServerError(e?.toString() ?? "Failed to start server");
      });
  }

  function stopServer() {
    setServerError(null);
    setIsServerStarting(false);
    invoke("stop_server")
      .then(() => {
        setIsServerRunning(false);
      })
      .catch((e) => {
        setServerError(e?.toString() ?? "Failed to stop server");
      });
  }

  function checkServerRunning() {
    if (serverBundleAvailable === false) {
      setIsServerStarting(false);
      setIsServerRunning(false);
      return;
    }
    invoke("is_server_running")
      .then((result) => {
        console.log(result);
        if (result) {
          setIsServerStarting(false);
          setIsServerRunning(true);
        } else {
          setIsServerRunning(false);
        }
      })
      .catch(() => {
        setIsServerRunning(false);
      })
      .finally(() => {
        timerRef.current = window.setTimeout(checkServerRunning, 1000);
      });
  }

  useEffect(() => {
    if (serverBundleAvailable === false) return;
    timerRef.current = window.setTimeout(checkServerRunning, 0);
    return () => {
      clearTimeout(timerRef.current);
    };
  }, [serverBundleAvailable]);

  const formSettings = useFormik({
    enableReinitialize: true,
    initialValues: {
      ...settings,
    },
    validationSchema: yup.object({
      port: yup.number().required().min(80).max(65535),
      listen_public: yup.boolean().required(),
      auto_start_up: yup.boolean().required(),
      auto_update: yup.boolean().required(),
      server_auto_update: yup.boolean().required(),
    }),
    onSubmit: () => undefined,
  });

  async function persistSettings(
    values: AppSettings,
    options: { restartServer: boolean } = {
      restartServer: false,
    }
  ) {
    await invoke("save_settings", { settings: values });
    if (settings.auto_start_up !== values.auto_start_up) {
      if (values.auto_start_up) {
        enable();
      } else {
        disable();
      }
    }
    if (
      options.restartServer &&
      settings.port !== values.port &&
      isServerRunning
    ) {
      restartServer();
    }
    setSettings(values);
  }

  async function handlePortBlur(event: FocusEvent<HTMLInputElement>) {
    formSettings.handleBlur(event);
    await persistSettings(formSettings.values, { restartServer: true });
  }

  async function handleAutoStartUpChange(event: ChangeEvent<HTMLInputElement>) {
    formSettings.handleChange(event);
    const next = {
      ...formSettings.values,
      auto_start_up: event.target.checked,
    };
    await persistSettings(next, { restartServer: false });
  }

  async function handleShowTrayIconChange(event: ChangeEvent<HTMLInputElement>) {
    formSettings.handleChange(event);
    const showTrayIcon = event.target.checked;
    const next = {
      ...formSettings.values,
      show_tray_icon: showTrayIcon,
    };
    await persistSettings(next, { restartServer: false });
    // Immediately apply tray visibility
    invoke("set_tray_visible", { visible: showTrayIcon });
  }

  async function handleShowDockIconChange(event: ChangeEvent<HTMLInputElement>) {
    formSettings.handleChange(event);
    const showDockIcon = event.target.checked;
    const next = {
      ...formSettings.values,
      show_dock_icon: showDockIcon,
    };
    await persistSettings(next, { restartServer: false });
    // Immediately apply dock visibility
    invoke("set_dock_visible", { visible: showDockIcon });
  }

  async function handleAutoUpdateChange(event: ChangeEvent<HTMLInputElement>) {
    formSettings.handleChange(event);
    const next = {
      ...formSettings.values,
      auto_update: event.target.checked,
    };
    await persistSettings(next, { restartServer: false });
    if (event.target.checked) {
      autoUpdateTriggeredRef.current = true;
      await handleCheckForUpdates({ autoInstall: true });
    } else {
      autoUpdateTriggeredRef.current = false;
    }
  }

  async function handleServerAutoUpdateChange(event: ChangeEvent<HTMLInputElement>) {
    formSettings.handleChange(event);
    const next = {
      ...formSettings.values,
      server_auto_update: event.target.checked,
    };
    await persistSettings(next, { restartServer: false });
    if (event.target.checked) {
      autoServerUpdateTriggeredRef.current = true;
      await handleCheckServerUpdate({ autoInstall: true });
    } else {
      autoServerUpdateTriggeredRef.current = false;
    }
  }

  async function handleListenPublicChange(event: ChangeEvent<HTMLInputElement>) {
    formSettings.handleChange(event);
    const next = {
      ...formSettings.values,
      listen_public: event.target.checked,
    };
    await persistSettings(next, { restartServer: true });
  }

  async function handleCheckForUpdates(
    options: { autoInstall?: boolean } = {}
  ) {
    setUpdateState((prev) => ({
      ...prev,
      checking: true,
      error: null,
      installed: false,
      lastCheckedAt: new Date().toISOString(),
    }));
    try {
      const update = await check();
      updateRef.current = update;
      if (!update) {
        setUpdateState((prev) => ({
          ...prev,
          checking: false,
          available: false,
          version: null,
          currentVersion: null,
          notes: null,
          date: null,
        }));
        return;
      }
      setUpdateState((prev) => ({
        ...prev,
        checking: false,
        available: true,
        version: update.version ?? null,
        currentVersion: update.currentVersion ?? null,
        notes: update.body ?? null,
        date: update.date ?? null,
      }));

      if (options.autoInstall) {
        await handleInstallUpdate(update);
      }
    } catch (e: any) {
      setUpdateState((prev) => ({
        ...prev,
        checking: false,
        available: false,
        version: null,
        currentVersion: null,
        notes: null,
        date: null,
        error: e?.toString() ?? "Failed to check for updates",
      }));
    }
  }

  async function handleInstallUpdate(update = updateRef.current) {
    if (!update) return;
    setUpdateState((prev) => ({
      ...prev,
      installing: true,
      error: null,
    }));
    try {
      await update.downloadAndInstall();
      await update.close();
      setUpdateState((prev) => ({
        ...prev,
        installing: false,
        available: false,
        installed: true,
      }));
    } catch (e: any) {
      setUpdateState((prev) => ({
        ...prev,
        installing: false,
        error: e?.toString() ?? "Failed to install update",
      }));
    }
  }

  async function handleCheckServerUpdate(
    options: { autoInstall?: boolean } = {}
  ) {
    setServerUpdateState((prev) => ({
      ...prev,
      checking: true,
      error: null,
      installed: false,
      lastCheckedAt: new Date().toISOString(),
    }));
    try {
      const info = await invoke<ServerJarUpdateInfo>("check_server_update");
      setServerUpdateState((prev) => ({
        ...prev,
        checking: false,
        available: info.available,
        latestVersion: info.latest_version,
        currentVersion: info.current_version ?? serverInfo?.jar_version ?? null,
        latestTag: info.latest_tag,
        notes: info.notes,
        date: info.date,
        assetName: info.asset_name,
        assetSize: info.asset_size,
        releaseUrl: info.release_url,
      }));

      if (options.autoInstall && info.available) {
        await handleInstallServerUpdate();
      }
    } catch (e: any) {
      setServerUpdateState((prev) => ({
        ...prev,
        checking: false,
        available: false,
        latestVersion: null,
        latestTag: null,
        notes: null,
        date: null,
        assetName: null,
        assetSize: null,
        releaseUrl: null,
        error: e?.toString() ?? "Failed to check for server updates",
      }));
    }
  }

  async function handleInstallServerUpdate() {
    setServerUpdateState((prev) => ({
      ...prev,
      installing: true,
      error: null,
    }));

    const shouldRestartServer = isServerRunning === true || isServerStarting;
    let stoppedServer = false;
    try {
      if (shouldRestartServer) {
        setIsServerStarting(false);
        await invoke("stop_server");
        stoppedServer = true;
        setIsServerRunning(false);
      }

      const info = await invoke<ServerInfo>("install_server_update");
      setServerInfo(info);
      setServerBundleAvailable(true);
      setServerUpdateState((prev) => ({
        ...prev,
        installing: false,
        available: false,
        currentVersion: info.jar_version ?? prev.latestVersion,
        installed: true,
      }));

      if (shouldRestartServer) {
        startServer();
      }
    } catch (e: any) {
      setServerUpdateState((prev) => ({
        ...prev,
        installing: false,
        error: e?.toString() ?? "Failed to install server update",
      }));
      if (shouldRestartServer && stoppedServer) {
        startServer();
      }
    }
  }

  function restartServer() {
    invoke("stop_server").then(() => startServer());
  }

  const tabKeys = ["server", "settings"];
  const activeTabKey = tabKeys[activeTab] ?? tabKeys[0];

  useEffect(() => {
    if (activeTab >= tabKeys.length) {
      setActiveTab(0);
    }
  }, [activeTab, tabKeys.length]);

  return (
    <div className={"flex flex-col h-full app-shell"}>
      <Box className="tab-rail">
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          centered
          sx={{
            minHeight: 64,
            "& .MuiTabs-indicator": {
              height: 3,
              borderRadius: 999,
              backgroundColor: "var(--accent-strong)",
            },
            "& .MuiTab-root": {
              minHeight: 64,
              textTransform: "none",
              fontWeight: 600,
              fontSize: 14,
            },
          }}
        >
          {tabKeys.map((key) => {
            if (key === "server") {
              return <Tab key={key} icon={<DnsIcon />} label="Server" />;
            }
            return <Tab key={key} icon={<SettingsIcon />} label="Settings" />;
          })}
        </Tabs>
      </Box>

      <div
        className={"flex-1 overflow-auto"}
        style={{ display: activeTabKey === "server" ? "block" : "none" }}
      >
        <ServerTab
          serverBundleAvailable={serverBundleAvailable}
          isServerRunning={isServerRunning}
          isServerStarting={isServerStarting}
          serverError={serverError}
          serverInfo={serverInfo}
          formSettings={formSettings}
          onStartServer={startServer}
          onStopServer={stopServer}
          onRestartServer={restartServer}
          onPortBlur={handlePortBlur}
          onListenPublicChange={handleListenPublicChange}
        />
      </div>

      <div
        className={"flex-1 overflow-auto"}
        style={{
          display: activeTabKey === "settings" ? "block" : "none",
        }}
      >
        <SettingsTab
          formSettings={formSettings}
          updateState={updateState}
          serverUpdateState={serverUpdateState}
          serverJarVersion={serverInfo?.jar_version ?? null}
          onAutoStartUpChange={handleAutoStartUpChange}
          onShowTrayIconChange={handleShowTrayIconChange}
          onShowDockIconChange={handleShowDockIconChange}
          onAutoUpdateChange={handleAutoUpdateChange}
          onServerAutoUpdateChange={handleServerAutoUpdateChange}
          onCheckForUpdates={() => handleCheckForUpdates()}
          onInstallUpdate={() => handleInstallUpdate()}
          onCheckServerUpdate={() => handleCheckServerUpdate()}
          onInstallServerUpdate={() => handleInstallServerUpdate()}
        />
      </div>
    </div>
  );
}

export default App;
