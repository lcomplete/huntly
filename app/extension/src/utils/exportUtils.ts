import html2canvas from "html2canvas";

export type ExportSource = "original" | "ai";

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
 * Convert a DOM element to a canvas image
 * Note: May not work correctly for elements inside Shadow DOM
 */
export async function elementToCanvas(
  element: HTMLElement
): Promise<HTMLCanvasElement> {
  return html2canvas(element, {
    backgroundColor: "#ffffff",
    scale: 2,
    useCORS: true,
    allowTaint: true,
    logging: false,
    scrollX: 0,
    scrollY: 0,
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
  });
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
 * Copy markdown text to clipboard
 */
export async function copyMarkdownToClipboard(
  markdown: string
): Promise<void> {
  await navigator.clipboard.writeText(markdown);
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

