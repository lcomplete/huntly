import { createRoot } from "react-dom/client";
import "./sidepanel.css";
import { SidepanelApp } from "./SidepanelApp";

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(<SidepanelApp />);
}
