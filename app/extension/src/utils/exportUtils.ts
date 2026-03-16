import html2canvas from "html2canvas";

export type ExportSource = "original" | "ai";

const EXPORT_SURFACE_PADDING = 16;

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
        imageNode.addEventListener(
          "error",
          () => resolve(),
          { once: true }
        );
      });
    })
  );
}

function createExportFrame(element: HTMLElement): {
  iframe: HTMLIFrameElement;
  exportRoot: HTMLElement;
} {
  const sourceDocument = element.ownerDocument;
  const sourceRoot = element.getRootNode();
  const { width, height } = getElementRenderSize(element);
  const exportWidth = width + EXPORT_SURFACE_PADDING * 2;

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
    }

    *, *::before, *::after {
      box-sizing: border-box;
    }
  </style>
</head>
<body></body>
</html>`);
  targetDocument.close();

  copyStyleNodes(
    sourceRoot instanceof ShadowRoot ? sourceRoot : sourceDocument,
    targetDocument
  );

  const exportRoot = targetDocument.createElement("div");
  exportRoot.setAttribute("data-huntly-export-root", "true");
  exportRoot.style.width = `${exportWidth}px`;
  exportRoot.style.padding = `${EXPORT_SURFACE_PADDING}px`;
  exportRoot.style.backgroundColor = "#ffffff";
  exportRoot.style.overflow = "hidden";

  const clonedElement = element.cloneNode(true) as HTMLElement;
  prepareClonedTree(clonedElement);
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
  element: HTMLElement
): Promise<HTMLCanvasElement> {
  const { iframe, exportRoot } = createExportFrame(element);

  try {
    const targetDocument = exportRoot.ownerDocument;
    await waitForFonts(targetDocument);
    await waitForImages(exportRoot);
    await waitForNextPaint(targetDocument);

    const { width, height } = getElementRenderSize(exportRoot);
    iframe.style.width = `${width}px`;
    iframe.style.height = `${height}px`;
    exportRoot.style.width = `${width}px`;

    return await html2canvas(exportRoot, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      allowTaint: true,
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

/**
 * Export element as PNG image download
 */
export async function exportAsImage(
  element: HTMLElement,
  filename: string = "huntly-export"
): Promise<void> {
  const canvas = await elementToCanvas(element);
  const dataUrl = canvas.toDataURL("image/png");

  const link = document.createElement("a");
  link.download = `${filename}.png`;
  link.href = dataUrl;
  link.click();
}

/**
 * Copy element as image to clipboard
 */
export async function copyImageToClipboard(
  element: HTMLElement
): Promise<void> {
  const canvas = await elementToCanvas(element);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          reject(new Error("Failed to create image blob"));
          return;
        }

        try {
          await navigator.clipboard.write([
            new ClipboardItem({
              "image/png": blob,
            }),
          ]);
          resolve();
        } catch (error) {
          reject(error);
        }
      },
      "image/png"
    );
  });
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

  // Clean up the URL object
  URL.revokeObjectURL(url);
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
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";

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
