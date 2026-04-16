import { defineContentScript } from "wxt/utils/define-content-script";
import { initContentScript } from "../src/content_script";

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_start",
  main() {
    initContentScript();
  },
});
