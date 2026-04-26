import { defineConfig } from "wxt";
import type { WxtDevServer } from "wxt";

const icons = {
  "16": "favicon-16x16.png",
  "32": "favicon-32x32.png",
  "128": "favicon-128x128.png",
} as const;

const devServerPort = process.env.WXT_DEV_PORT;
const devServerOrigin = process.env.WXT_DEV_ORIGIN;
const extensionVersion =
  process.env.EXTENSION_VERSION || process.env.npm_package_version || "0.5.5";

const pageEntrypointTypes = new Set([
  "bookmarks",
  "devtools",
  "history",
  "newtab",
  "options",
  "popup",
  "sandbox",
  "sidepanel",
  "unlisted-page",
]);

const muiVendorPackages = [
  "/node_modules/@mui/",
  "/node_modules/@emotion/",
  "/node_modules/@popperjs/",
  "/node_modules/react-transition-group/",
];

const reactVendorPackages = [
  "/node_modules/react/",
  "/node_modules/react-dom/",
  "/node_modules/scheduler/",
];

type BuildEntrypoint = {
  type: string;
};

type MutableRollupOutput = {
  manualChunks?: typeof manualChunks;
};

function normalizeModuleId(id: string) {
  return id.replace(/\\/g, "/");
}

function matchesAnyPackage(id: string, packages: readonly string[]) {
  return packages.some((packagePath) => id.includes(packagePath));
}

function manualChunks(id: string) {
  const normalizedId = normalizeModuleId(id);

  if (!normalizedId.includes("/node_modules/")) {
    return;
  }

  if (matchesAnyPackage(normalizedId, muiVendorPackages)) {
    return "mui-vendor";
  }

  if (matchesAnyPackage(normalizedId, reactVendorPackages)) {
    return "react-vendor";
  }
}

function isPageBuildGroup(entrypoints: readonly BuildEntrypoint[]) {
  return entrypoints.every((entrypoint) => pageEntrypointTypes.has(entrypoint.type));
}

function applyPageBuildChunks(
  entrypoints: readonly BuildEntrypoint[],
  viteConfig: { build?: { rollupOptions?: { output?: unknown } } },
) {
  if (!isPageBuildGroup(entrypoints)) {
    return;
  }

  viteConfig.build ??= {};
  viteConfig.build.rollupOptions ??= {};

  if (Array.isArray(viteConfig.build.rollupOptions.output)) {
    return;
  }

  const output = (viteConfig.build.rollupOptions.output ??= {}) as MutableRollupOutput;
  output.manualChunks = manualChunks;
}

function getDevServerConfig() {
  if (!devServerPort && !devServerOrigin) {
    return undefined;
  }

  return {
    server: {
      ...(devServerPort ? { port: Number(devServerPort) } : {}),
      ...(devServerOrigin ? { origin: devServerOrigin } : {}),
    },
  };
}

function preventPageRefresh(server: WxtDevServer) {
  const originalOn = server.ws.on.bind(server.ws);

  server.ws.on = (message, callback) => {
    // WXT doesn't expose a public switch for disabling HTML page reloads, so
    // we intercept the internal event and keep the rest of HMR intact.
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
      preventPageRefresh(server);
    },
    "vite:build:extendConfig": (entrypoints, viteConfig) => {
      applyPageBuildChunks(entrypoints, viteConfig);
    },
  },
  // Keep the dev server running without launching a browser automatically.
  webExt: {
    disabled: true,
  },
  dev: getDevServerConfig(),
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
    version: extensionVersion,
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
