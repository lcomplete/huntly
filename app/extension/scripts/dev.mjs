import { readFile, writeFile } from "node:fs/promises";
import net from "node:net";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const wxtDetectDevChangesPath = path.resolve(
  scriptDir,
  "../node_modules/wxt/dist/core/utils/building/detect-dev-changes.mjs",
);

const wxtImportPatchFrom = 'import { normalizePath } from "../paths.mjs";';
const wxtImportPatchTo = 'import { isHtmlEntrypoint } from "../entrypoints.mjs";\nimport { normalizePath } from "../paths.mjs";';

const wxtHtmlReloadPatchFrom = `	if (changedFiles.length > 0 && every(changedFiles, (file) => file.endsWith(".html"))) return {
		type: "html-reload",
		cachedOutput: unchangedOutput,
		rebuildGroups: changedOutput.steps.map((step) => step.entrypoints)
	};
	if (changedOutput.steps.length > 0 && every(changedOutput.steps.flatMap((step) => step.entrypoints), (entry) => entry.type === "content-script")) return {`;

const wxtHtmlReloadPatchTo = `	const isOnlyHtmlEntries = changedOutput.steps.length > 0 && every(changedOutput.steps.flatMap((step) => step.entrypoints), (entry) => isHtmlEntrypoint(entry));
	if (isOnlyHtmlEntries) {
		if (some(changedFiles, (file) => file.endsWith(".html"))) return {
			type: "html-reload",
			cachedOutput: unchangedOutput,
			rebuildGroups: changedOutput.steps.map((step) => step.entrypoints)
		};
		return { type: "no-change" };
	}
	if (changedOutput.steps.length > 0 && every(changedOutput.steps.flatMap((step) => step.entrypoints), (entry) => entry.type === "content-script")) return {`;

async function ensureWxtHtmlHmrPatch() {
  let source;

  try {
    source = await readFile(wxtDetectDevChangesPath, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return;
    }
    throw error;
  }

  if (source.includes("const isOnlyHtmlEntries =")) {
    return;
  }

  if (!source.includes(wxtImportPatchFrom) || !source.includes(wxtHtmlReloadPatchFrom)) {
    console.warn("[huntly] Skipped WXT dev HMR patch because the installed file format was unexpected.");
    return;
  }

  const patchedSource = source
    .replace(wxtImportPatchFrom, wxtImportPatchTo)
    .replace(wxtHtmlReloadPatchFrom, wxtHtmlReloadPatchTo);

  if (patchedSource === source) {
    return;
  }

  await writeFile(wxtDetectDevChangesPath, patchedSource, "utf8");
  console.log("[huntly] Applied WXT dev HMR patch for HTML entrypoints.");
}

async function isPortAvailableOnHost(port, host) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", (error) => {
      if (error && typeof error === "object" && "code" in error) {
        if (error.code === "EAFNOSUPPORT" || error.code === "EADDRNOTAVAIL") {
          resolve(true);
          return;
        }
      }
      resolve(false);
    });

    server.once("listening", () => {
      server.close(() => resolve(true));
    });

    server.listen(port, host);
  });
}

async function isPortAvailable(port) {
  const results = await Promise.all([
    isPortAvailableOnHost(port, "127.0.0.1"),
    isPortAvailableOnHost(port, "::1"),
  ]);

  return results.every(Boolean);
}

async function findAvailablePort(startPort, maxAttempts = 20) {
  for (let offset = 0; offset < maxAttempts; offset += 1) {
    const port = startPort + offset;
    if (await isPortAvailable(port)) {
      return port;
    }
  }

  throw new Error(`Unable to find an available port starting from ${startPort}.`);
}

async function main() {
  await ensureWxtHtmlHmrPatch();

  const requestedPort = process.env.WXT_DEV_PORT
    ? Number.parseInt(process.env.WXT_DEV_PORT, 10)
    : null;

  const port =
    requestedPort && Number.isInteger(requestedPort)
      ? requestedPort
      : await findAvailablePort(3101);

  const env = {
    ...process.env,
    WXT_DEV_PORT: String(port),
    WXT_DEV_ORIGIN: process.env.WXT_DEV_ORIGIN || `http://localhost:${port}`,
  };

  const command = process.platform === "win32" ? "wxt.cmd" : "wxt";
  const child = spawn(command, process.argv.slice(2), {
    env,
    stdio: "inherit",
  });

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });

  child.on("error", (error) => {
    console.error("Failed to start WXT dev server:", error);
    process.exit(1);
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
