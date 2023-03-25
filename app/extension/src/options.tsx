import React from "react";
import {createRoot} from "react-dom/client";
import {Settings} from "./settings";

const root = createRoot(
  document.getElementById("root") as HTMLElement
);

root.render(
  <Settings/>
);
