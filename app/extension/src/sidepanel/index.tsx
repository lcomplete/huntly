import { createRoot } from "react-dom/client";
import "./sidepanel.css";
import { SidepanelApp } from "./SidepanelApp";
import { ExtensionI18nProvider } from "../i18n";

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(
    <ExtensionI18nProvider>
      <SidepanelApp />
    </ExtensionI18nProvider>
  );
}
