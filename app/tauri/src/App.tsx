import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";
import { isString, useFormik } from "formik";
import * as yup from "yup";
import {
  Alert,
  Button,
  CircularProgress,
  Paper,
  Switch,
  TextField,
} from "@mui/material";
import EnergySavingsLeafIcon from "@mui/icons-material/EnergySavingsLeaf";
import { enable, isEnabled, disable } from "@tauri-apps/plugin-autostart";

type AppSettings = {
  port: number;
  auto_start_up: boolean;
};

function App() {
  const [settings, setSettings] = useState<AppSettings>({
    port: 8123,
    auto_start_up: true,
  });
  const [isServerRunning, setIsServerRunning] = useState<boolean | undefined>();
  const [isServerStarting, setIsServerStarting] = useState<boolean>(false);
  const timerRef = useRef<number>();

  useEffect(() => {
    invoke("read_settings").then(async (result) => {
      if (result && isString(result)) {
        const appSettings = JSON.parse(result) as AppSettings;
        setSettings(appSettings);
        if(appSettings.auto_start_up && !await isEnabled()){
          enable();
        }
        else if(!appSettings.auto_start_up && await isEnabled()){
          disable();
        }
      }
    });
  }, []);

  useEffect(() => {
    invoke("is_server_started").then((result) => {
      if (!result) {
        startServer();
      }
    });
  }, []);

  function startServer() {
    invoke("start_server")
      .then((result) => {
        setIsServerStarting(true);
      })
      .catch(() => {
        setIsServerStarting(false);
        setIsServerRunning(false);
      });
  }

  function checkServerRunning() {
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
    timerRef.current = window.setTimeout(checkServerRunning, 0);
    return () => {
      clearTimeout(timerRef.current);
    };
  }, []);

  const formSettings = useFormik({
    enableReinitialize: true,
    initialValues: {
      ...settings,
    },
    validationSchema: yup.object({
      port: yup.number().required().min(80).max(65535),
      auto_start_up: yup.boolean().required(),
    }),
    onSubmit: (values,helpers) => {
      invoke("save_settings", { settings: values }).then((result) => {
        if (settings.port !== values.port) {
          restartServer();
        }
        if (settings.auto_start_up !== values.auto_start_up) {
          if (values.auto_start_up) {
            enable();
          } else {
            disable();
          }
        }
        setSettings(values);
      });
    },
  });

  function restartServer() {
    invoke("stop_server").then((result) => {
      startServer();
    });
  }

  return (
    <div className={"flex items-center justify-center h-full"}>
      <Paper className={"w-[530px] flex justify-center pb-14"} elevation={0}>
        <div className={"w-9/12"}>
          <form onSubmit={formSettings.handleSubmit} className={""}>
            <div className="mt-8 flex justify-center text-sky-600 font-bold">
              <EnergySavingsLeafIcon
                className="mr-1"
                sx={{ width: 50, height: 50 }}
              />
            </div>
            <div className={"flex justify-center"}>
              <h1>Server settings</h1>
            </div>

            <div>
              <TextField
                margin="dense"
                id="port"
                label="Server port"
                value={formSettings.values.port}
                onChange={formSettings.handleChange}
                error={
                  formSettings.touched.port && Boolean(formSettings.errors.port)
                }
                helperText={
                  formSettings.touched.port && formSettings.errors.port
                }
                type="number"
                fullWidth
                variant="outlined"
              />
            </div>
            <div className={"mt-4 flex items-center justify-between"}>
              <div className="flex-1">
                <div className="font-medium text-gray-900">Launch on Start</div>
                <div className="text-sm text-gray-500">Start Huntly automatically whenever you restart your computer.</div>
              </div>
              <Switch
                checked={!!formSettings.values.auto_start_up}
                name={"auto_start_up"}
                onChange={formSettings.handleChange}
              />
            </div>
            <div className={"mt-8"}>
              <Button
                type="submit"
                color="primary"
                variant="contained"
                fullWidth={true}
              >
                save
              </Button>
            </div>
            <div className={"mt-8 flex justify-center"}>
              {isServerStarting && (
                <div className="flex flex-col justify-center">
                  <Alert severity="info" className="" icon={false}>
                    <div className="flex items-center">
                      <CircularProgress size={20} />
                      <span className="ml-2">Starting server...</span>
                    </div>
                  </Alert>
                </div>
              )}
              {!isServerStarting && isServerRunning && (
                <div className="flex justify-center">
                  <Alert severity="success">Server is running.
                  <a href={"http://localhost:"+settings.port} target="_blank" className="ml-2">{"http://localhost:"+settings.port}</a>
                  </Alert>
                </div>
              )}
              {!isServerStarting &&
                isServerRunning != undefined &&
                !isServerRunning && (
                  <div className="flex justify-center">
                    <Alert severity="warning">Server is not running.</Alert>
                  </div>
                )}
            </div>
          </form>
        </div>
      </Paper>
    </div>
  );
}

export default App;
