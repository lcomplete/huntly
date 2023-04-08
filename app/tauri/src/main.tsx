import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { CssBaseline, StyledEngineProvider } from "@mui/material";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <StyledEngineProvider injectFirst>
    <CssBaseline />
    <App />
  </StyledEngineProvider>
);
