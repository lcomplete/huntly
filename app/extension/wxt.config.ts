import { defineConfig } from "wxt";
import type { WxtDevServer } from "wxt";

const icons = {
  "16": "favicon-16x16.png",
  "32": "favicon-32x32.png",
  "128": "favicon-128x128.png",
} as const;

const devServerPort = process.env.WXT_DEV_PORT;
const devServerOrigin = process.env.WXT_DEV_ORIGIN;
function disablePageRefresh(server: WxtDevServer) {
  const originalOn = server.ws.on.bind(server.ws);

  server.ws.on = (message, callback) => {
    // Only block page refresh to prevent auto-reloading the browser tab,
    // but allow background-initialized so extension HMR keeps working.
    if (message === "wxt:reload-page") {
      return originalOn(message, () => {});
    }
    return originalOn(message, callback);
  };
}

export default defineConfig({
  browser: "chrome",
  targetBrowsers: ["chrome"],
  manifestVersion: 3,
  srcDir: ".",
  outDir: "dist",
  outDirTemplate: ".",
  modules: ["@wxt-dev/module-react"],
  hooks: {
    "server:created": (_wxt, server) => {
      disablePageRefresh(server);
    },
  },
  // Keep the dev server running without launching a browser automatically.
  webExt: {
    disabled: true,
  },
  dev:
    devServerPort || devServerOrigin
      ? {
          server: {
            ...(devServerPort ? { port: Number(devServerPort) } : {}),
            ...(devServerOrigin ? { origin: devServerOrigin } : {}),
          },
        }
      : undefined,
  vite: ({ mode }) => ({
    define: {
      __HUNTLY_DEV__: JSON.stringify(mode === "development"),
    },
    build: {
      chunkSizeWarningLimit: 1200,
    },
    optimizeDeps: {
      entries: [
        "entrypoints/options/index.html",
        "entrypoints/popup/index.html",
        "entrypoints/sidepanel/index.html",
      ],
    },
  }),
  manifest: ({ browser }) => ({
    version: process.env.EXTENSION_VERSION || "0.5.4",
    name: "__MSG_extensionName__",
    description: "__MSG_extensionDescription__",
    default_locale: "en",
    icons,
    action: {
      default_icon: icons,
    },
    permissions: ["storage", "tabs", "contextMenus"],
    host_permissions: ["<all_urls>"],
    web_accessible_resources: [
      {
        resources: ["/tweet-interceptor.js"],
        matches: ["<all_urls>"],
      },
    ],
    browser_specific_settings:
      browser === "firefox"
        ? {
            gecko: {
              id: "huntlyextension@gmail.com",
            },
          }
        : undefined,
  }),
});
