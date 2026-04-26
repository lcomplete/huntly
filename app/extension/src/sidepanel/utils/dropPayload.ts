export const DROPPABLE_STRING_TYPES = new Set([
  "text/plain",
  "text/uri-list",
  "text/html",
  "text/x-moz-url",
  "text/x-moz-url-data",
  "DownloadURL",
]);

export function isImageDataUrl(value: string): boolean {
  return /^data:image\//i.test(value.trim());
}

const IMAGE_EXTENSION_MEDIA_TYPES: Record<string, string> = {
  avif: "image/avif",
  bmp: "image/bmp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  svg: "image/svg+xml",
  tif: "image/tiff",
  tiff: "image/tiff",
  webp: "image/webp",
};

export function getImageFileMediaType(file: File): string | null {
  const mediaType = file.type.trim().toLowerCase();
  if (mediaType.startsWith("image/")) return mediaType;

  const extension = file.name.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  return extension ? IMAGE_EXTENSION_MEDIA_TYPES[extension] || null : null;
}

export function isImageFile(file: File): boolean {
  return Boolean(getImageFileMediaType(file));
}

export function isBlobUrl(value: string): boolean {
  return /^blob:/i.test(value.trim());
}

export function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

function looksLikeRelativeUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || /\s/.test(trimmed)) return false;

  return (
    trimmed.startsWith("/") ||
    trimmed.startsWith("./") ||
    trimmed.startsWith("../") ||
    trimmed.includes("/") ||
    /\.[a-z0-9]{2,8}(?:[?#].*)?$/i.test(trimmed)
  );
}

function normalizeDroppedSource(
  value: string,
  baseUrl?: string | null
): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (isHttpUrl(trimmed) || isImageDataUrl(trimmed) || isBlobUrl(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith("//")) {
    try {
      return new URL(trimmed, baseUrl || "https://example.com").toString();
    } catch {
      return null;
    }
  }

  if (!baseUrl) return null;
  if (!looksLikeRelativeUrl(trimmed)) return null;

  try {
    const resolved = new URL(trimmed, baseUrl).toString();
    if (isHttpUrl(resolved) || isImageDataUrl(resolved) || isBlobUrl(resolved)) {
      return resolved;
    }
  } catch {
    return null;
  }

  return null;
}

function collectUrlsFromSrcset(value: string, baseUrl?: string | null): string[] {
  return value
    .split(",")
    .map((candidate) => candidate.trim().split(/\s+/)[0] || "")
    .map((candidate) => normalizeDroppedSource(candidate, baseUrl))
    .filter((candidate): candidate is string => Boolean(candidate));
}

function collectUrlsFromText(value: string, baseUrl?: string | null): string[] {
  return value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => normalizeDroppedSource(entry, baseUrl))
    .filter((entry): entry is string => Boolean(entry));
}

function collectUrlsFromDownloadUrl(
  value: string,
  baseUrl?: string | null
): string[] {
  const match = value.match(/^[^:]+:[^:]*:(.+)$/);
  if (!match?.[1]) return [];

  const normalized = normalizeDroppedSource(match[1], baseUrl);
  return normalized ? [normalized] : [];
}

function collectImageSourcesFromHtml(
  html: string,
  baseUrl?: string | null
): string[] {
  const sources = new Set<string>();

  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const nodes = doc.querySelectorAll("img, source");

    nodes.forEach((node) => {
      const src = node.getAttribute("src");
      const srcset = node.getAttribute("srcset");

      const normalizedSrc = src ? normalizeDroppedSource(src, baseUrl) : null;
      if (normalizedSrc) {
        sources.add(normalizedSrc);
      }

      if (srcset) {
        collectUrlsFromSrcset(srcset, baseUrl).forEach((value) =>
          sources.add(value)
        );
      }
    });
  } catch {
    // Ignore malformed HTML payloads from drag-and-drop.
  }

  return Array.from(sources);
}

function readDragItemAsString(item: DataTransferItem): Promise<string> {
  return new Promise((resolve) => {
    item.getAsString((value) => resolve(value || ""));
  });
}

function dedupeFiles(files: File[]): File[] {
  const seen = new Set<string>();
  return files.filter((file) => {
    const key = [file.name, file.size, file.type, file.lastModified].join(":");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function imageFilesOnly(files: File[]): File[] {
  return files.filter(isImageFile);
}

export interface DroppedPayload {
  files: File[];
  sources: string[];
}

export async function extractDroppedPayload(
  dataTransfer: DataTransfer,
  baseUrl?: string | null
): Promise<DroppedPayload> {
  const items = Array.from(dataTransfer.items || []);
  const filesFromItems = imageFilesOnly(
    dedupeFiles(
      items
        .filter((item) => item.kind === "file")
        .map((item) => item.getAsFile())
        .filter((file): file is File => Boolean(file))
    )
  );

  const files =
    filesFromItems.length > 0
      ? filesFromItems
      : imageFilesOnly(dedupeFiles(Array.from(dataTransfer.files || [])));

  const stringItems = await Promise.all(
    items
      .filter(
        (item) =>
          item.kind === "string" && DROPPABLE_STRING_TYPES.has(item.type)
      )
      .map(async (item) => ({
        type: item.type,
        value: (await readDragItemAsString(item)).trim(),
      }))
  );

  const sources = new Set<string>();

  for (const item of stringItems) {
    if (!item.value) continue;

    if (item.type === "text/html") {
      collectImageSourcesFromHtml(item.value, baseUrl).forEach((value) =>
        sources.add(value)
      );
      continue;
    }

    if (item.type === "DownloadURL") {
      collectUrlsFromDownloadUrl(item.value, baseUrl).forEach((value) =>
        sources.add(value)
      );
      continue;
    }

    collectUrlsFromText(item.value, baseUrl).forEach((value) =>
      sources.add(value)
    );
  }

  collectUrlsFromText(dataTransfer.getData("text/uri-list"), baseUrl).forEach(
    (value) => sources.add(value)
  );
  collectImageSourcesFromHtml(dataTransfer.getData("text/html"), baseUrl).forEach(
    (value) => sources.add(value)
  );
  collectUrlsFromText(dataTransfer.getData("text/plain"), baseUrl).forEach(
    (value) => sources.add(value)
  );
  collectUrlsFromText(dataTransfer.getData("text/x-moz-url"), baseUrl).forEach(
    (value) => sources.add(value)
  );
  collectUrlsFromDownloadUrl(dataTransfer.getData("DownloadURL"), baseUrl).forEach(
    (value) => sources.add(value)
  );

  return {
    files,
    sources: Array.from(sources),
  };
}
