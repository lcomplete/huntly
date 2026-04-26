import { defineBackground } from "wxt/utils/define-background";
import { initBackground } from "../src/background";

type RegisteredContentScript = {
  id: string;
  matches: string[];
  js: string[];
  runAt: "document_start" | "document_end" | "document_idle";
};

type DynamicScriptingApi = typeof chrome.scripting & {
  getRegisteredContentScripts?: () => Promise<Array<{ id: string }>>;
  registerContentScripts?: (scripts: RegisteredContentScript[]) => Promise<void>;
};

/**
 * In WXT dev mode, content scripts are not declared in the manifest.
 * They are dynamically registered via the dev server WebSocket.
 * If the dev server is not running (e.g., loading a stale dev build),
 * content scripts will never be injected.
 *
 * This fallback ensures content scripts are always registered,
 * even when the dev server is unavailable.
 */
async function ensureContentScriptsRegistered(): Promise<void> {
  // Only needed when manifest doesn't already declare content_scripts
  const manifest = chrome.runtime.getManifest();
  if (manifest.content_scripts && manifest.content_scripts.length > 0) {
    return; // Production build - content scripts are in manifest
  }

  // Dev build without content_scripts in manifest - register them dynamically
  const scripting = chrome.scripting as DynamicScriptingApi | undefined;
  if (!scripting?.registerContentScripts || !scripting.getRegisteredContentScripts) {
    return; // API not available
  }

  try {
    const registered = await scripting.getRegisteredContentScripts();
    const registeredIds = new Set(registered.map((cs) => cs.id));

    const scriptsToRegister: RegisteredContentScript[] = [];

    if (!registeredIds.has("huntly:content")) {
      scriptsToRegister.push({
        id: "huntly:content",
        matches: ["<all_urls>"],
        js: ["content-scripts/content.js"],
        runAt: "document_start",
      });
    }

    if (!registeredIds.has("huntly:web-clipper")) {
      scriptsToRegister.push({
        id: "huntly:web-clipper",
        matches: ["<all_urls>"],
        js: ["content-scripts/web-clipper.js"],
        runAt: "document_end",
      });
    }

    if (scriptsToRegister.length > 0) {
      await scripting.registerContentScripts(scriptsToRegister);
      console.log("[Huntly] Registered content scripts as fallback:", scriptsToRegister.map((s) => s.id));
    }
  } catch (error) {
    console.error("[Huntly] Failed to register content scripts:", error);
  }
}

export default defineBackground(() => {
  void ensureContentScriptsRegistered();
  initBackground();
});
