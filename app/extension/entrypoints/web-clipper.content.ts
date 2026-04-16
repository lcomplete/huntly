import { defineContentScript } from "wxt/utils/define-content-script";
import { initWebClipper } from "../src/web_clipper";

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_end",
  main() {
    initWebClipper();
  },
});
