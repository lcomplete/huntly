import html2canvas from "html2canvas";

export type ExportSource = "original" | "ai";

const EXPORT_SURFACE_PADDING = 16;
const DEFAULT_EXPORT_SCALE = 2;
// Chrome and Firefox can export close to 32k px per side; using 16k forces
// long-but-safe pages to downscale more than necessary.
const MAX_EXPORT_CANVAS_DIMENSION = 32767;
const MAX_EXPORT_CANVAS_PIXELS = 268_000_000;
const MIN_EXPORT_SCALE = 0.1;
const IMAGE_EXPORT_PLACEHOLDER = "Image omitted in export";
const EMBED_EXPORT_PLACEHOLDER = "Embedded media omitted in export";

const EXPORT_FRAME_STYLE = [
  "position: fixed",
  "top: 0",
  "left: -10000px",
  "opacity: 0",
  "pointer-events: none",
  "border: 0",
  "overflow: hidden",
  "background: #ffffff",
  "z-index: -1",
].join("; ");

/**
 * Get the markdown body styles for PDF export
 */
function getPdfExportStyles(): string {
  return `
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", "Noto Sans CJK SC", "Noto Sans CJK TC", "Noto Sans CJK JP", "Noto Sans CJK KR", "Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", "Source Han Sans CN", "WenQuanYi Micro Hei", Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #24292f;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    h1, h2, h3, h4, h5, h6 { font-weight: 600; margin-top: 24px; margin-bottom: 16px; }
    h1 { font-size: 2em; border-bottom: 1px solid #d0d7de; padding-bottom: 0.3em; }
    h2 { font-size: 1.5em; border-bottom: 1px solid #d0d7de; padding-bottom: 0.3em; }
    p { margin: 1em 0; }
    code { background: #f6f8fa; padding: 0.2em 0.4em; border-radius: 6px; font-size: 85%; font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace; }
    pre { background: #f6f8fa; padding: 16px; border-radius: 6px; overflow: auto; white-space: pre-wrap; font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace; }
    pre code { background: none; padding: 0; }
    blockquote { border-left: 4px solid #d0d7de; margin: 0; padding-left: 1em; color: #57606a; }
    img { max-width: 100%; height: auto; }
    a { color: #0969da; text-decoration: none; }
    table { border-collapse: collapse; margin: 16px 0; }
    th, td { border: 1px solid #d0d7de; padding: 6px 13px; }
    th { background: #f6f8fa; }
    ul, ol { padding-left: 2em; }
    /* Thinking panel styles for PDF */
    .huntly-thinking-panel, details { margin: 0 0 20px 0; border: 1px solid #e5e7eb; border-radius: 8px; background: #ffffff; overflow: hidden; page-break-inside: avoid; }
    .huntly-thinking-summary, summary { list-style: none; padding: 8px 12px; font-size: 11px; font-weight: 600; color: #111827; background: #f9fafb; border-bottom: 1px solid #e5e7eb; }
    .huntly-thinking-summary::-webkit-details-marker, summary::-webkit-details-marker { display: none; }
    .huntly-thinking-body { padding: 12px 14px; font-size: 12px; color: #4b5563; line-height: 1.7; }
    .huntly-thinking-markdown { font-size: 12px; color: #4b5563; }
    /* Hide loading and UI elements */
    .huntly-loading-placeholder, .huntly-thinking-spinner, .huntly-thinking-chevron { display: none !important; }
    @media print {
      body { padding: 0; }
      @page { margin: 1.5cm; }
    }
  `;
}

/**
 * Collect styles from the element's render root so the export surface can
 * reproduce Shadow DOM scoped content inside an isolated iframe.
 */
function collectStyleNodes(
  root: Document | ShadowRoot
): Array<HTMLStyleElement | HTMLLinkElement> {
  if (root instanceof ShadowRoot) {
    return Array.from(
      root.querySelectorAll<HTMLStyleElement | HTMLLinkElement>(
        "style, link[rel='stylesheet']"
      )
    );
  }

  return Array.from(
    root.head.querySelectorAll<HTMLStyleElement | HTMLLinkElement>(
      "style, link[rel='stylesheet']"
    )
  );
}

function copyStyleNodes(
  sourceRoot: Document | ShadowRoot,
  targetDocument: Document
): void {
  const targetHead = targetDocument.head;

  collectStyleNodes(sourceRoot).forEach((styleNode) => {
    targetHead.appendChild(styleNode.cloneNode(true));
  });
}

function getElementRenderSize(element: HTMLElement): {
  width: number;
  height: number;
} {
  const rect = element.getBoundingClientRect();

  return {
    width: Math.max(
      Math.ceil(rect.width),
      element.scrollWidth,
      element.clientWidth,
      element.offsetWidth,
      1
    ),
    height: Math.max(
      Math.ceil(rect.height),
      element.scrollHeight,
      element.clientHeight,
      element.offsetHeight,
      1
    ),
  };
}

interface ElementToCanvasOptions {
  sanitizeUnsafeMedia?: boolean;
}

function collectElements<T extends Element>(
  root: HTMLElement,
  selector: string
): T[] {
  const elements: T[] = [];

  if (root.matches(selector)) {
    elements.push(root as unknown as T);
  }

  elements.push(...Array.from(root.querySelectorAll<T>(selector)));
  return elements;
}

function parseExportResourceUrl(
  value: string | null | undefined,
  baseUri: string
): URL | null {
  if (!value) {
    return null;
  }

  const normalizedValue = value.trim().replace(/^['"]|['"]$/g, "");
  if (!normalizedValue) {
    return null;
  }

  try {
    return new URL(normalizedValue, baseUri);
  } catch {
    return null;
  }
}

function isSafeExportResourceUrl(url: URL, sourceOrigin: string): boolean {
  if (
    url.protocol === "data:" ||
    url.protocol === "blob:" ||
    url.protocol === "about:" ||
    url.protocol === "chrome-extension:" ||
    url.protocol === "moz-extension:"
  ) {
    return true;
  }

  return url.origin === sourceOrigin;
}

function hasUnsafeUrlInCssValue(
  value: string,
  sourceOrigin: string,
  baseUri: string
): boolean {
  const matches = value.match(/url\((.*?)\)/gi);
  if (!matches) {
    return false;
  }

  return matches.some((match) => {
    const resourceUrl = parseExportResourceUrl(
      match.slice(match.indexOf("(") + 1, match.lastIndexOf(")")),
      baseUri
    );

    return resourceUrl ? !isSafeExportResourceUrl(resourceUrl, sourceOrigin) : false;
  });
}

export function calculateExportScale(width: number, height: number): number {
  const widestSide = Math.max(width, height, 1);
  const totalPixels = Math.max(width * height, 1);
  const dimensionScale = MAX_EXPORT_CANVAS_DIMENSION / widestSide;
  const pixelScale = Math.sqrt(MAX_EXPORT_CANVAS_PIXELS / totalPixels);
  const computedScale = Math.min(
    DEFAULT_EXPORT_SCALE,
    dimensionScale,
    pixelScale
  );

  if (!Number.isFinite(computedScale) || computedScale <= 0) {
    return 1;
  }

  return Math.max(MIN_EXPORT_SCALE, computedScale);
}

function measureSourceElementSize(element: HTMLElement): {
  width: number;
  height: number;
} {
  const rect = element.getBoundingClientRect();
  const width = Math.max(
    Math.ceil(rect.width),
    element.clientWidth,
    element.scrollWidth,
    element instanceof HTMLImageElement ? element.naturalWidth : 0,
    element instanceof HTMLCanvasElement ? element.width : 0,
    1
  );
  const height = Math.max(
    Math.ceil(rect.height),
    element.clientHeight,
    element.scrollHeight,
    element instanceof HTMLImageElement ? element.naturalHeight : 0,
    element instanceof HTMLCanvasElement ? element.height : 0,
    1
  );

  return {
    width,
    height,
  };
}

function createExportPlaceholder(
  targetDocument: Document,
  sourceElement: HTMLElement,
  label: string
): HTMLDivElement {
  const placeholder = targetDocument.createElement("div");
  const { width, height } = measureSourceElementSize(sourceElement);
  const sourceWindow = sourceElement.ownerDocument.defaultView;
  const computedStyle = sourceWindow?.getComputedStyle(sourceElement);
  const isInline = computedStyle?.display.startsWith("inline");

  placeholder.setAttribute("data-huntly-export-omitted", "true");
  placeholder.textContent =
    sourceElement.getAttribute("alt")?.trim() || label;
  placeholder.style.display = isInline ? "inline-flex" : "flex";
  placeholder.style.alignItems = "center";
  placeholder.style.justifyContent = "center";
  placeholder.style.padding = "8px 12px";
  placeholder.style.maxWidth = "100%";
  if (width > 1) {
    placeholder.style.width = `${width}px`;
  } else {
    placeholder.style.minWidth = "120px";
  }
  placeholder.style.minHeight = "48px";
  placeholder.style.height = `${Math.max(height, 48)}px`;
  placeholder.style.backgroundColor = "#f8fafc";
  placeholder.style.border = "1px dashed #cbd5e1";
  placeholder.style.borderRadius = "8px";
  placeholder.style.color = "#64748b";
  placeholder.style.fontSize = "12px";
  placeholder.style.lineHeight = "1.4";
  placeholder.style.textAlign = "center";
  placeholder.style.boxSizing = "border-box";
  placeholder.style.overflow = "hidden";

  return placeholder;
}

/**
 * Test whether an image can be drawn on a canvas without tainting it.
 * This catches cross-origin images, same-origin URLs that redirect to
 * cross-origin, and any other scenario that would produce a SecurityError.
 */
function isImageExportSafe(img: HTMLImageElement): boolean {
  if (!img.complete || !img.naturalWidth || !img.naturalHeight) {
    return false;
  }

  try {
    const testCanvas = document.createElement("canvas");
    testCanvas.width = 1;
    testCanvas.height = 1;
    const ctx = testCanvas.getContext("2d");
    if (!ctx) return false;
    ctx.drawImage(img, 0, 0, 1, 1);
    testCanvas.toDataURL();
    return true;
  } catch {
    return false;
  }
}

function replaceUnsafeImages(
  originalElement: HTMLElement,
  clonedElement: HTMLElement
): void {
  const originalImages = collectElements<HTMLImageElement>(originalElement, "img");
  const clonedImages = collectElements<HTMLImageElement>(clonedElement, "img");
  const pairCount = Math.min(originalImages.length, clonedImages.length);

  for (let index = 0; index < pairCount; index += 1) {
    const originalImage = originalImages[index];
    const clonedImage = clonedImages[index];

    if (isImageExportSafe(originalImage)) {
      continue;
    }

    const replacementTarget =
      clonedImage.parentElement instanceof HTMLPictureElement
        ? clonedImage.parentElement
        : clonedImage;

    replacementTarget.replaceWith(
      createExportPlaceholder(
        replacementTarget.ownerDocument,
        originalImage,
        IMAGE_EXPORT_PLACEHOLDER
      )
    );
  }
}

function replaceEmbeddedElements(
  originalElement: HTMLElement,
  clonedElement: HTMLElement,
  selector: string
): void {
  const originalNodes = collectElements<HTMLElement>(originalElement, selector);
  const clonedNodes = collectElements<HTMLElement>(clonedElement, selector);
  const pairCount = Math.min(originalNodes.length, clonedNodes.length);

  for (let index = 0; index < pairCount; index += 1) {
    const originalNode = originalNodes[index];
    const clonedNode = clonedNodes[index];

    clonedNode.replaceWith(
      createExportPlaceholder(
        clonedNode.ownerDocument,
        originalNode,
        EMBED_EXPORT_PLACEHOLDER
      )
    );
  }
}

function removeExternalSvgImages(
  clonedElement: HTMLElement,
  baseUri: string
): void {
  const svgImages = Array.from(
    clonedElement.querySelectorAll<SVGImageElement>("image")
  );

  for (const svgImage of svgImages) {
    const href =
      svgImage.getAttribute("href") || svgImage.getAttribute("xlink:href");
    const url = parseExportResourceUrl(href, baseUri);

    if (url && (url.protocol === "http:" || url.protocol === "https:")) {
      svgImage.remove();
    }
  }
}

function stripUnsafeBackgroundImages(
  clonedElement: HTMLElement,
  sourceOrigin: string,
  baseUri: string
): void {
  const styledNodes = collectElements<HTMLElement>(clonedElement, "[style]");

  styledNodes.forEach((styledNode) => {
    const { background, backgroundImage } = styledNode.style;

    if (backgroundImage && hasUnsafeUrlInCssValue(backgroundImage, sourceOrigin, baseUri)) {
      styledNode.style.backgroundImage = "none";
    }

    if (background && hasUnsafeUrlInCssValue(background, sourceOrigin, baseUri)) {
      styledNode.style.backgroundImage = "none";
    }
  });
}

export function sanitizeClonedMediaForExport(
  originalElement: HTMLElement,
  clonedElement: HTMLElement,
  sourceOrigin: string,
  baseUri: string
): void {
  replaceUnsafeImages(originalElement, clonedElement);
  replaceEmbeddedElements(originalElement, clonedElement, "canvas");
  replaceEmbeddedElements(originalElement, clonedElement, "video");
  replaceEmbeddedElements(originalElement, clonedElement, "iframe");
  removeExternalSvgImages(clonedElement, baseUri);
  stripUnsafeBackgroundImages(clonedElement, sourceOrigin, baseUri);
}

// Computed font properties to inline on cloned elements – prevents
// html2canvas text overlap caused by lost inherited/scoped styles.
const FONT_LAYOUT_PROPERTIES = [
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "font-variant",
  "font-stretch",
  "letter-spacing",
  "word-spacing",
  "line-height",
  "text-transform",
  "white-space",
  "-webkit-font-smoothing",
  "text-indent",
  "text-size-adjust",
  "-webkit-text-size-adjust",
  "word-break",
  "overflow-wrap",
  "hyphens",
];

function inlineFontStyles(
  originalElement: HTMLElement,
  clonedElement: HTMLElement
): void {
  const sourceWindow = originalElement.ownerDocument.defaultView;
  if (!sourceWindow) return;

  const queue: Array<[HTMLElement, HTMLElement]> = [
    [originalElement, clonedElement],
  ];

  while (queue.length > 0) {
    const [origEl, cloneEl] = queue.pop()!;
    const computed = sourceWindow.getComputedStyle(origEl);

    for (const prop of FONT_LAYOUT_PROPERTIES) {
      const value = computed.getPropertyValue(prop);
      if (value) {
        cloneEl.style.setProperty(prop, value);
      }
    }

    const origChildren = origEl.children;
    const cloneChildren = cloneEl.children;
    const count = Math.min(origChildren.length, cloneChildren.length);
    for (let i = 0; i < count; i++) {
      const origChild = origChildren[i];
      const cloneChild = cloneChildren[i];
      if (
        origChild instanceof HTMLElement &&
        cloneChild instanceof HTMLElement
      ) {
        queue.push([origChild, cloneChild]);
      }
    }
  }
}

function stripScaleFromInlineTransform(transform: string): string {
  const normalizedTransform = transform
    .replace(/\bscale(?:3d|X|Y)?\([^)]*\)\s*/gi, " ")
    .trim()
    .replace(/\s{2,}/g, " ");

  return normalizedTransform || "none";
}

/**
 * The parser keeps source-page inline styles. Some sites use `zoom` or
 * `transform: scale(...)` for article text, and html2canvas can render those
 * with overlapped glyphs/lines. Keep preview unchanged, but normalize these
 * styles in the export clone only.
 */
function normalizeProblematicInlineTextStyles(
  originalElement: HTMLElement,
  clonedElement: HTMLElement
): void {
  const queue: Array<[HTMLElement, HTMLElement]> = [
    [originalElement, clonedElement],
  ];

  while (queue.length > 0) {
    const [origEl, cloneEl] = queue.pop()!;
    const inlineZoom = origEl.style.getPropertyValue("zoom").trim();
    if (inlineZoom && inlineZoom !== "1" && inlineZoom !== "100%") {
      cloneEl.style.setProperty("zoom", "1");
    }

    const inlineScale = origEl.style.getPropertyValue("scale").trim();
    if (inlineScale && inlineScale !== "1" && inlineScale !== "none") {
      cloneEl.style.setProperty("scale", "1");
    }

    const inlineTransform = origEl.style.getPropertyValue("transform").trim();
    if (/\bscale(?:3d|X|Y)?\(/i.test(inlineTransform)) {
      cloneEl.style.setProperty(
        "transform",
        stripScaleFromInlineTransform(inlineTransform)
      );
    }

    const origChildren = origEl.children;
    const cloneChildren = cloneEl.children;
    const count = Math.min(origChildren.length, cloneChildren.length);
    for (let i = 0; i < count; i++) {
      const origChild = origChildren[i];
      const cloneChild = cloneChildren[i];
      if (
        origChild instanceof HTMLElement &&
        cloneChild instanceof HTMLElement
      ) {
        queue.push([origChild, cloneChild]);
      }
    }
  }
}

function prepareClonedTree(clonedElement: HTMLElement): void {
  if (clonedElement.tagName === "SCRIPT") {
    clonedElement.remove();
    return;
  }

  clonedElement.querySelectorAll("script").forEach((scriptNode) => {
    scriptNode.remove();
  });

  if (clonedElement instanceof HTMLImageElement) {
    clonedElement.loading = "eager";
    clonedElement.decoding = "sync";
  }

  clonedElement.querySelectorAll("img").forEach((imageNode) => {
    imageNode.loading = "eager";
    imageNode.decoding = "sync";
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (!blob) {
          try {
            canvas.toDataURL("image/png");
          } catch (error) {
            reject(error);
            return;
          }

          reject(new Error("Failed to create image blob"));
          return;
        }

        resolve(blob);
      }, "image/png");
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Fetch an image via the background service worker (privileged context)
 * which bypasses CORS restrictions that apply to content scripts in MV3.
 */
function fetchImageViaBackground(imageUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(
        { type: "fetch_image", payload: { url: imageUrl } },
        (response) => {
          if (chrome.runtime.lastError || !response?.success) {
            resolve(null);
            return;
          }
          resolve(response.dataUrl);
        }
      );
    } catch {
      resolve(null);
    }
  });
}

/**
 * Convert export-unsafe images to data URLs using the background service
 * worker's privileged fetch. This covers both explicit cross-origin images
 * and same-origin URLs that redirect to a different origin at load time,
 * such as GitHub's /raw/ image routes.
 */
async function convertCrossOriginImages(
  originalRoot: HTMLElement,
  clonedRoot: HTMLElement,
  sourceOrigin: string,
  baseUri: string
): Promise<void> {
  const originalImages = collectElements<HTMLImageElement>(originalRoot, "img");
  const clonedImages = collectElements<HTMLImageElement>(clonedRoot, "img");
  const pairCount = Math.min(originalImages.length, clonedImages.length);

  const conversions = Array.from({ length: pairCount }, async (_, index) => {
    const originalImage = originalImages[index];
    const clonedImage = clonedImages[index];
    const src =
      clonedImage.getAttribute("src") ||
      originalImage.currentSrc ||
      originalImage.getAttribute("src");
    if (!src) return;

    const url = parseExportResourceUrl(src, baseUri);
    if (!url) return;

    // Skip non-HTTP URLs – data:, blob:, extension: are already safe.
    if (url.protocol !== "http:" && url.protocol !== "https:") return;

    const imageLoaded = Boolean(
      originalImage.complete &&
        originalImage.naturalWidth > 0 &&
        originalImage.naturalHeight > 0
    );

    if (imageLoaded && isImageExportSafe(originalImage)) {
      return;
    }

    // Avoid fetching ordinary same-origin images that simply haven't loaded
    // yet. If the already-loaded image is still unsafe, fetch it regardless
    // of origin to handle redirecting asset URLs.
    if (!imageLoaded && url.origin === sourceOrigin) {
      return;
    }

    try {
      const dataUrl = await fetchImageViaBackground(url.href);
      if (!dataUrl) return;

      clonedImage.src = dataUrl;

      // Clear srcset / <picture> <source>s so the browser uses the data URL.
      if (clonedImage.srcset) {
        clonedImage.removeAttribute("srcset");
      }
      if (clonedImage.parentElement instanceof HTMLPictureElement) {
        clonedImage.parentElement
          .querySelectorAll("source")
          .forEach((sourceNode) => sourceNode.remove());
      }
    } catch {
      // Fetch failed – leave the original src; the existing sanitize
      // fallback will replace it with a placeholder if needed.
    }
  });

  await Promise.all(conversions);
}

function waitForNextPaint(targetDocument: Document): Promise<void> {
  const view = targetDocument.defaultView;

  if (!view) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    view.requestAnimationFrame(() => {
      view.requestAnimationFrame(() => resolve());
    });
  });
}

async function waitForFonts(targetDocument: Document): Promise<void> {
  if (targetDocument.fonts) {
    await targetDocument.fonts.ready;
  }
}

/**
 * Copy loaded FontFace objects from the source document to the target iframe
 * document.  This ensures fonts loaded via the FontFace JS API (not declared
 * in any stylesheet) are available for html2canvas text measurement.
 */
async function copyFontFaces(
  sourceDocument: Document,
  targetDocument: Document
): Promise<void> {
  if (!sourceDocument.fonts || !targetDocument.fonts) return;

  for (const face of sourceDocument.fonts) {
    try {
      if (face.status === "loaded") {
        targetDocument.fonts.add(face);
      }
    } catch {
      // FontFace may already exist or be incompatible in target context
    }
  }

  await targetDocument.fonts.ready;
}

/**
 * Extract @font-face rules from a document's stylesheets and inject them into
 * the target document.  Used to carry over host-page web-font declarations
 * when the export source lives inside a Shadow DOM – the Shadow DOM inherits
 * fonts from the host but the export iframe does not.
 */
function copyFontFaceRules(
  sourceDocument: Document,
  targetDocument: Document
): void {
  const rules: string[] = [];

  try {
    for (const sheet of Array.from(sourceDocument.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules)) {
          if (rule instanceof CSSFontFaceRule) {
            rules.push(rule.cssText);
          }
        }
      } catch {
        // Cross-origin stylesheets throw SecurityError
      }
    }
  } catch {
    // styleSheets may not be accessible
  }

  if (rules.length > 0) {
    const style = targetDocument.createElement("style");
    style.textContent = rules.join("\n");
    targetDocument.head.appendChild(style);
  }
}

/**
 * Wait for all <link rel="stylesheet"> elements in the target document to
 * finish loading.  Without this, html2canvas may render the page before
 * copied stylesheets are applied, causing incorrect text layout (e.g. font
 * overlap, wrong line-height).
 */
async function waitForStylesheets(targetDocument: Document): Promise<void> {
  const links = Array.from(
    targetDocument.querySelectorAll<HTMLLinkElement>("link[rel='stylesheet']")
  );

  if (links.length === 0) return;

  await Promise.all(
    links.map((link) => {
      if (link.sheet) return Promise.resolve();
      return new Promise<void>((resolve) => {
        link.addEventListener("load", () => resolve(), { once: true });
        link.addEventListener("error", () => resolve(), { once: true });
        // Safety timeout – don't block forever on a slow CDN stylesheet
        setTimeout(resolve, 5000);
      });
    })
  );
}

async function waitForImages(targetNode: ParentNode): Promise<void> {
  const images =
    targetNode instanceof HTMLImageElement
      ? [targetNode]
      : Array.from(targetNode.querySelectorAll("img"));

  await Promise.all(
    images.map((imageNode) => {
      if (imageNode.complete) {
        return Promise.resolve();
      }

      return new Promise<void>((resolve) => {
        imageNode.addEventListener("load", () => resolve(), { once: true });
        imageNode.addEventListener("error", () => resolve(), { once: true });
      });
    })
  );
}

function appendExportHeadingTextFixStyles(targetDocument: Document): void {
  const style = targetDocument.createElement("style");
  style.textContent = `
    [data-huntly-export-root] h1,
    [data-huntly-export-root] h1 *,
    [data-huntly-export-root] h2,
    [data-huntly-export-root] h2 *,
    [data-huntly-export-root] h3,
    [data-huntly-export-root] h3 *,
    [data-huntly-export-root] h4,
    [data-huntly-export-root] h4 *,
    [data-huntly-export-root] h5,
    [data-huntly-export-root] h5 *,
    [data-huntly-export-root] h6,
    [data-huntly-export-root] h6 * {
      letter-spacing: 0.01em !important;
      word-spacing: normal !important;
      text-rendering: auto !important;
      font-kerning: normal !important;
      font-feature-settings: "liga" 0, "clig" 0 !important;
      font-variant: normal !important;
      font-variant-ligatures: none !important;
      -webkit-font-variant-ligatures: none !important;
    }
  `;
  targetDocument.head.appendChild(style);
}

function createExportFrameWithOptions(
  element: HTMLElement,
  options: ElementToCanvasOptions
): {
  iframe: HTMLIFrameElement;
  exportRoot: HTMLElement;
} {
  const sourceDocument = element.ownerDocument;
  const sourceRoot = element.getRootNode();
  const { width, height } = getElementRenderSize(element);
  const exportWidth = width + EXPORT_SURFACE_PADDING * 2;
  const sourceOrigin = sourceDocument.location?.origin || window.location.origin;
  const sourceBaseUri = sourceDocument.baseURI;

  const iframe = sourceDocument.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.tabIndex = -1;
  iframe.style.cssText = `${EXPORT_FRAME_STYLE}; width: ${exportWidth}px; height: ${height}px;`;

  sourceDocument.body.appendChild(iframe);

  const targetDocument = iframe.contentDocument;
  if (!targetDocument) {
    iframe.remove();
    throw new Error("Failed to create export frame document");
  }

  targetDocument.open();
  targetDocument.write(`<!DOCTYPE html>
<html lang="${sourceDocument.documentElement.lang || "en"}">
<head>
  <meta charset="utf-8">
  <base href="${sourceDocument.baseURI}">
  <style>
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
    }

    body {
      display: block;
      color: #24292f;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji";
    }

    *, *::before, *::after {
      box-sizing: border-box;
    }
  </style>
</head>
<body></body>
</html>`);
  targetDocument.close();

  if (sourceRoot instanceof ShadowRoot) {
    // Carry over @font-face rules from the host page – the shadow DOM
    // inherits these fonts but the export iframe does not.
    copyFontFaceRules(sourceDocument, targetDocument);
  }

  copyStyleNodes(
    sourceRoot instanceof ShadowRoot ? sourceRoot : sourceDocument,
    targetDocument
  );
  appendExportHeadingTextFixStyles(targetDocument);

  if (options.sanitizeUnsafeMedia) {
    const safeStyle = targetDocument.createElement("style");
    safeStyle.textContent = `
      [data-huntly-export-root] *,
      [data-huntly-export-root] *::before,
      [data-huntly-export-root] *::after {
        background-image: none !important;
      }
    `;
    targetDocument.head.appendChild(safeStyle);
  }

  const exportRoot = targetDocument.createElement("div");
  exportRoot.setAttribute("data-huntly-export-root", "true");
  exportRoot.style.width = `${exportWidth}px`;
  exportRoot.style.padding = `${EXPORT_SURFACE_PADDING}px`;
  exportRoot.style.backgroundColor = "#ffffff";
  exportRoot.style.overflow = "hidden";

  const clonedElement = element.cloneNode(true) as HTMLElement;
  // Inline font styles BEFORE prepareClonedTree – the latter removes
  // <script> nodes from the clone which desynchronises index-based child
  // matching between original and cloned trees.
  inlineFontStyles(element, clonedElement);
  normalizeProblematicInlineTextStyles(element, clonedElement);
  prepareClonedTree(clonedElement);
  if (options.sanitizeUnsafeMedia) {
    sanitizeClonedMediaForExport(
      element,
      clonedElement,
      sourceOrigin,
      sourceBaseUri
    );
  }
  exportRoot.appendChild(clonedElement);
  targetDocument.body.appendChild(exportRoot);

  return {
    iframe,
    exportRoot,
  };
}

/**
 * Convert a DOM element to a canvas image. Elements rendered inside Shadow DOM
 * are first projected into an isolated light DOM iframe so html2canvas can
 * render the full content with the correct styles.
 */
export async function elementToCanvas(
  element: HTMLElement,
  options: ElementToCanvasOptions = {}
): Promise<HTMLCanvasElement> {
  const { iframe, exportRoot } = createExportFrameWithOptions(element, options);

  try {
    const targetDocument = exportRoot.ownerDocument;
    const sourceDocument = element.ownerDocument;
    const sourceOrigin =
      sourceDocument.location?.origin || window.location.origin;
    const sourceBaseUri = sourceDocument.baseURI;

    // Convert export-unsafe images to data URLs before html2canvas runs so
    // they can be rendered without tainting the canvas.
    await convertCrossOriginImages(
      element,
      exportRoot,
      sourceOrigin,
      sourceBaseUri
    );

    await waitForStylesheets(targetDocument);
    await copyFontFaces(sourceDocument, targetDocument);
    await waitForFonts(targetDocument);
    await waitForImages(exportRoot);
    await waitForNextPaint(targetDocument);
    // Force layout reflow so the browser recalculates text metrics with
    // the now-loaded fonts before html2canvas captures.
    void exportRoot.offsetHeight;
    await waitForNextPaint(targetDocument);

    const { width, height } = getElementRenderSize(exportRoot);
    const scale = calculateExportScale(width, height);
    iframe.style.width = `${width}px`;
    iframe.style.height = `${height}px`;
    exportRoot.style.width = `${width}px`;

    // First pass: allowTaint: true so cross-origin images are drawn (even
    // though they taint the canvas). The taint is caught later in toBlob()
    // which triggers a sanitized retry.  In the sanitized retry unsafe media
    // has already been stripped, so allowTaint: false is safe.
    return await html2canvas(exportRoot, {
      backgroundColor: "#ffffff",
      scale,
      useCORS: true,
      allowTaint: !options.sanitizeUnsafeMedia,
      imageTimeout: 15000,
      logging: false,
      scrollX: 0,
      scrollY: 0,
      width,
      height,
      windowWidth: width,
      windowHeight: height,
    });
  } finally {
    iframe.remove();
  }
}

function isTaintedCanvasError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "SecurityError") {
    return true;
  }

  return (
    error instanceof Error &&
    /tainted canvases may not be exported/i.test(error.message)
  );
}

async function elementToBlob(element: HTMLElement): Promise<Blob> {
  const canvas = await elementToCanvas(element);

  try {
    return await canvasToBlob(canvas);
  } catch (error) {
    if (!isTaintedCanvasError(error)) {
      throw error;
    }
  }

  console.warn(
    "Canvas export was tainted by embedded media. Retrying without unsafe media."
  );

  const safeCanvas = await elementToCanvas(element, {
    sanitizeUnsafeMedia: true,
  });
  return canvasToBlob(safeCanvas);
}

/**
 * Export element as PNG image download
 */
export async function exportAsImage(
  element: HTMLElement,
  filename: string = "huntly-export"
): Promise<void> {
  const blob = await elementToBlob(element);
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.download = `${filename}.png`;
  link.href = url;
  link.click();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}

/**
 * Copy element as image to clipboard
 */
export async function copyImageToClipboard(
  element: HTMLElement
): Promise<void> {
  const blob = await elementToBlob(element);

  await navigator.clipboard.write([
    new ClipboardItem({
      "image/png": blob,
    }),
  ]);
}

/**
 * Prepare markdown content with title
 */
function prepareMarkdownWithTitle(markdown: string, title?: string): string {
  if (title?.trim()) {
    return `# ${title}\n\n${markdown}`;
  }
  return markdown;
}

/**
 * Copy markdown text to clipboard
 */
export async function copyMarkdownToClipboard(
  markdown: string,
  title?: string
): Promise<void> {
  const content = prepareMarkdownWithTitle(markdown, title);
  await navigator.clipboard.writeText(content);
}

/**
 * Export markdown as .md file download
 */
export function exportAsMarkdown(
  markdown: string,
  filename: string = "huntly-export",
  title?: string
): void {
  const content = prepareMarkdownWithTitle(markdown, title);
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.download = `${filename}.md`;
  link.href = url;
  link.click();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}

/**
 * Export as PDF using browser print
 * Uses an iframe in the current page to trigger print dialog directly
 */
export function exportAsPdf(
  element: HTMLElement,
  title: string = "Huntly Export"
): void {
  // Create a hidden iframe for printing
  const iframe = document.createElement("iframe");
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";

  const styles = getPdfExportStyles();
  const htmlContent = `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<title>${title}</title>
<style>${styles}</style>
</head>
<body>${element.innerHTML}</body>
</html>`;

  // Use srcdoc for better encoding support
  iframe.srcdoc = htmlContent;

  iframe.onload = () => {
    const iframeWindow = iframe.contentWindow;
    if (iframeWindow) {
      setTimeout(() => {
        iframeWindow.focus();
        iframeWindow.print();
        // Remove iframe after print dialog closes
        setTimeout(() => {
          iframe.remove();
        }, 100);
      }, 100);
    }
  };

  document.body.appendChild(iframe);
}
