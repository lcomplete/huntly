// This file exports the CSS styles as a string for injection into Shadow DOM
// We use a separate file to avoid webpack's style-loader injecting into document head

export const getShadowDomStyles = (): string => `
/* Reset box-sizing for Shadow DOM - don't reset margin/padding to avoid affecting MUI components */
*, *::before, *::after {
  box-sizing: border-box;
}

/* Ensure text selection is enabled */
* {
  -webkit-user-select: text !important;
  -moz-user-select: text !important;
  -ms-user-select: text !important;
  user-select: text !important;
}

/* Modal overlay styles */
.huntly-modal-overlay {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  z-index: 999999 !important;
  overflow: hidden !important;
  overscroll-behavior: none !important;
  background-color: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

/* Modal content */
.huntly-modal-content {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: white;
  border: none;
  padding: 0;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.huntly-modal-inner {
  position: relative;
  height: 100%;
  overflow: hidden;
  touch-action: none;
}

/* Header bar */
.huntly-header-bar {
  background-color: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  padding: 12px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
  z-index: 1000;
  flex-shrink: 0;
}

/* Content area */
.huntly-content-area {
  display: flex;
  flex: 1;
  overflow: hidden;
  height: calc(100% - 60px);
  position: relative;
  z-index: 1;
}

/* Article section */
.huntly-article-section {
  transition: width 0.3s ease;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Scroll container */
.huntly-scroll-container {
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  height: 100%;
  max-height: 100%;
  padding: 24px;
  position: relative;
  z-index: 0;
  /* Contain fixed/sticky nodes from parsed HTML so they cannot cover the header toolbar. */
  transform: translateZ(0);
}

/* Processed section */
.huntly-processed-section {
  width: 50%;
  border-left: 1px solid #e0e0e0;
  background-color: #ffffff;
  transition: all 0.3s ease;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  position: relative;
}

/* Loading animation */
.huntly-loading-placeholder {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 24px;
}

.huntly-loading-bar {
  height: 12px;
  background-color: #e2e8f0;
  border-radius: 6px;
  animation: huntly-pulse 1.5s ease-in-out infinite;
}

@keyframes huntly-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Header right section */
.huntly-header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
}

/* Parser selector */
.huntly-parser-selector {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  background: #f5f5f5;
  border-radius: 6px;
}

.huntly-parser-label {
  font-size: 12px;
  color: #666;
  white-space: nowrap;
  font-weight: 500;
}

.huntly-parser-select {
  padding: 4px 8px;
  font-size: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  outline: none;
  min-width: 100px;
}

.huntly-parser-select:hover {
  border-color: #1976d2;
}

.huntly-parser-select:focus {
  border-color: #1976d2;
  box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.2);
}

/* Close button */
.huntly-close-button {
  width: 32px;
  height: 32px;
  border: none;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
  flex-shrink: 0;
}

.huntly-close-button:hover {
  background: rgba(0, 0, 0, 0.1);
}

.huntly-close-button svg {
  width: 18px;
  height: 18px;
  color: #666;
}

/* Markdown body styles */
.huntly-markdown-body {
  -ms-text-size-adjust: 100%;
  -webkit-text-size-adjust: 100%;
  margin: 0;
  color: #24292f;
  background-color: #ffffff;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  font-size: 16px;
  line-height: 1.5;
  word-wrap: break-word;
}

.huntly-markdown-body a {
  color: #0969da;
  text-decoration: none;
}

.huntly-markdown-body a:hover {
  text-decoration: underline;
}

.huntly-markdown-body h1 {
  margin: .67em 0;
  font-weight: 600;
  padding-bottom: .3em;
  font-size: 2em;
  border-bottom: 1px solid #d0d7de;
}

.huntly-markdown-body h2 {
  font-weight: 600;
  padding-bottom: .3em;
  font-size: 1.5em;
  border-bottom: 1px solid #d0d7de;
  margin-top: 24px;
  margin-bottom: 16px;
}

.huntly-markdown-body h3 {
  font-weight: 600;
  font-size: 1.25em;
  margin-top: 24px;
  margin-bottom: 16px;
}

.huntly-markdown-body h4, .huntly-markdown-body h5, .huntly-markdown-body h6 {
  font-weight: bold;
  margin-top: 24px;
  margin-bottom: 16px;
}

.huntly-markdown-body p {
  display: block;
  margin-block-start: 1em;
  margin-block-end: 1em;
}

.huntly-markdown-body img {
  max-width: 100%;
  height: auto;
}

.huntly-markdown-body blockquote {
  margin: 0;
  padding: 0 1em;
  color: #57606a;
  border-left: .25em solid #d0d7de;
  margin-bottom: 1em;
}

.huntly-markdown-body ul, .huntly-markdown-body ol {
  margin-block-start: 1em;
  margin-block-end: 1em;
  padding-left: 2em;
}

.huntly-markdown-body code {
  padding: .2em .4em;
  margin: 0;
  font-size: 85%;
  background-color: rgba(175, 184, 193, 0.2);
  border-radius: 6px;
  font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace;
}

.huntly-markdown-body pre {
  padding: 16px;
  overflow: auto;
  font-size: 85%;
  line-height: 1.45;
  background-color: #f6f8fa;
  border-radius: 6px;
  white-space: pre-wrap;
  font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace;
}

.huntly-markdown-body pre code {
  padding: 0;
  margin: 0;
  background: transparent;
  border: 0;
  font-size: 100%;
}

.huntly-markdown-body table {
  border-spacing: 0;
  border-collapse: collapse;
  max-width: 100%;
  margin-bottom: 16px;
}

.huntly-markdown-body table th,
.huntly-markdown-body table td {
  padding: 6px 13px;
  border: 1px solid #d0d7de;
}

.huntly-markdown-body table th {
  font-weight: 600;
  background-color: #f6f8fa;
}

.huntly-markdown-body hr {
  height: .25em;
  padding: 0;
  margin: 24px 0;
  background-color: #d0d7de;
  border: 0;
}

.huntly-markdown-body figure {
  margin: 1em 40px;
}

.huntly-markdown-body figcaption {
  font-size: 0.9em;
  color: #57606a;
  text-align: center;
  margin-top: 8px;
}
`;

export default getShadowDomStyles;
