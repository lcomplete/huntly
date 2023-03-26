import React from "react";
import {createRoot} from "react-dom/client";
import {Settings} from "./settings";
import {CssBaseline, StyledEngineProvider} from "@mui/material";

const root = createRoot(
  document.getElementById("root") as HTMLElement
);

root.render(
  <StyledEngineProvider injectFirst>
    <CssBaseline/>
    <Settings/>
  </StyledEngineProvider>
);
