import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import "./App.css";
import { isString, useFormik } from "formik";
import * as yup from "yup";
import {
  Button,
  FormControlLabel,
  Paper,
  Switch,
  TextField,
} from "@mui/material";
import EnergySavingsLeafIcon from "@mui/icons-material/EnergySavingsLeaf";

type AppSettings = {
  port: number;
  auto_start_up: boolean;
};

function App() {
  const [settings, setSettings] = useState<AppSettings>({
    port: 8123,
    auto_start_up: true,
  });

  useEffect(()=>{
    invoke("read_settings").then((result) => {
      if(result && isString(result)){
        setSettings(JSON.parse(result));
      }
    });
  })

  const formSettings = useFormik({
    enableReinitialize: true,
    initialValues: {
      ...settings,
    },
    validationSchema: yup.object({
      port: yup.number().required().min(80).max(65535),
      auto_start_up: yup.boolean().required(),
    }),
    onSubmit: (values) => {
      invoke("save_settings", { settings: values }).then((result) => {
        console.log(result);
      });
    },
  });

  return (
    <div className={"flex items-center justify-center h-full bg-[#fafafa]"}>
      <Paper className={"w-[530px] flex justify-center"} elevation={4}>
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
            <div className={"mt-2"}>
              <FormControlLabel
                control={
                  <Switch
                    value={true}
                    checked={!!formSettings.values.auto_start_up}
                    name={"auto_start_up"}
                    onChange={formSettings.handleChange}
                  />
                }
                label="Auto Startup"
              />
            </div>
            <div className={'mt-8'}>
              <Button
                type="submit"
                color="primary"
                variant="contained"
                fullWidth={true}
              >
                save
              </Button>
            </div>
          </form>

          <div className={"text-center mt-20 mb-6 text-gray-400"}>
            Copyright ©{" "}
            <a
              href={"https://twitter.com/lcomplete_wild"}
              target={"_blank"}
              className={"text-sky-600 hover:underline"}
            >
              lcomplete
            </a>{" "}
            2023.
          </div>
        </div>
      </Paper>
    </div>
  );
}

export default App;
