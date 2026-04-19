import { PROVIDER_REGISTRY } from "../../ai/types";
import type { ProviderType } from "../../ai/types";

export function formatFileSize(size: number | undefined): string {
  if (!size) return "";

  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const formatted =
    value < 10 && unitIndex > 0 ? value.toFixed(1) : String(Math.round(value));
  return `${formatted} ${units[unitIndex]}`;
}

export function getProviderLabel(provider: string): string {
  return PROVIDER_REGISTRY[provider as ProviderType]?.displayName || provider;
}

export function formatModelName(modelId: string | undefined): string {
  if (!modelId) return "Model";

  const withoutDate = modelId.replace(/-\d{8}$/, "");
  if (withoutDate.startsWith("claude-")) {
    return withoutDate
      .replace(/^claude-/, "")
      .replace(/-/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  return withoutDate.length > 28
    ? `${withoutDate.slice(0, 25)}...`
    : withoutDate;
}

export function formatTabHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function prettyPrint(value: unknown): string {
  const parsed = parseMaybeJson(value);
  if (typeof parsed === "string") return parsed;

  try {
    return JSON.stringify(parsed ?? {}, null, 2);
  } catch {
    return String(value ?? "");
  }
}
