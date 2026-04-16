// This file exports the CSS styles as a string for injection into Shadow DOM.
// Keep it separate so style-loader does not inject these styles into document head.

export const getShadowDomStyles = (): string => `
/* Reset all inherited styles from host page to prevent external CSS interference */
:host {
  all: initial !important;
  display: contents !important;
}

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

/* Custom scrollbar styles to override any external page styles */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3);
}

/* Firefox scrollbar */
* {
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.2) transparent;
}

/* Shadow content container - reset all inherited styles */
#huntly-shadow-content {
  all: initial;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  font-size: 16px;
  line-height: 1.5;
  color: #333;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
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
  /* Ensure modal overlay creates a new stacking context */
  isolation: isolate;
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
  /* Create a new stacking context to isolate internal positioned elements */
  isolation: isolate;
}

/* Ensure elements inside scroll container don't escape and block text selection */
.huntly-scroll-container * {
  /* Reset any fixed/absolute positioning from external content that might escape */
  max-width: 100%;
}

/* Force fixed/absolute elements inside scroll container to stay contained */
.huntly-scroll-container [style*="position: fixed"],
.huntly-scroll-container [style*="position:fixed"] {
  position: absolute !important;
}

/* Ensure article content allows text selection */
.huntly-scroll-container article,
.huntly-scroll-container .huntly-markdown-body {
  position: relative;
  z-index: 1;
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

/* ============================================
   Thinking Panel - Ultra Minimalist Style
   Clean, subtle, and refined
   ============================================ */

.huntly-thinking-panel {
  margin: 0 0 20px 0;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #ffffff;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
}

.huntly-thinking-panel[open] {
  border-color: #d1d5db;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
}

.huntly-thinking-summary {
  list-style: none;
  cursor: pointer;
  user-select: none;
  padding: 8px 12px;
  transition: background-color 0.2s ease;
  outline: none;
}

.huntly-thinking-summary:hover {
  background: #f8fafc;
}

.huntly-thinking-summary:focus-visible {
  box-shadow: inset 0 0 0 2px rgba(59, 130, 246, 0.16);
}

.huntly-thinking-summary::-webkit-details-marker {
  display: none;
}

.huntly-thinking-summary-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 32px;
}

.huntly-thinking-status-row {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.huntly-thinking-title {
  font-size: 11px;
  font-weight: 600;
  color: #111827;
  letter-spacing: 0.01em;
}

.huntly-thinking-chevron {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  color: #374151;
  background: #ffffff;
  transform: rotate(0deg);
  transition: transform 0.2s ease, border-color 0.2s ease, background-color 0.2s ease, color 0.2s ease;
}

.huntly-thinking-chevron svg {
  width: 12px;
  height: 12px;
}

.huntly-thinking-panel[open] .huntly-thinking-chevron {
  transform: rotate(180deg);
  border-color: #d1d5db;
  background: #f8fafc;
}

/* Minimal spinner - thin and subtle */
.huntly-thinking-spinner {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 1.5px solid #d1d5db;
  border-top-color: #6b7280;
  animation: huntly-spin 0.8s linear infinite;
  flex-shrink: 0;
}

.huntly-thinking-body {
  border-top: 1px solid #eef2f7;
  background: linear-gradient(180deg, #fcfcfd 0%, #ffffff 100%);
  padding: 12px 14px 14px 14px;
}

.huntly-thinking-markdown {
  font-size: 12px;
  color: #4b5563;
  line-height: 1.7;
  max-height: min(320px, 38vh);
  overflow: auto;
  padding-right: 4px;
}

.huntly-thinking-markdown > :first-child {
  margin-top: 0;
}

.huntly-thinking-markdown > :last-child {
  margin-bottom: 0;
}

.huntly-thinking-markdown::-webkit-scrollbar {
  width: 8px;
}

.huntly-thinking-markdown::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 999px;
}

.huntly-thinking-markdown::-webkit-scrollbar-track {
  background: transparent;
}

.huntly-thinking-empty {
  min-height: 44px;
  display: flex;
  align-items: center;
  font-size: 12px;
  color: #6b7280;
}

@keyframes huntly-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes huntly-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Header right section */
.huntly-header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
}

/* Button group - visually combined buttons */
.huntly-button-group {
  display: inline-flex;
  align-items: center;
  background: #fafafa;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 8px;
  padding: 2px;
  gap: 2px;
}

.huntly-button-group > * {
  border-radius: 6px !important;
}

.huntly-button-group .huntly-icon-button {
  width: 30px;
  height: 30px;
}

.huntly-button-group .huntly-icon-button:hover {
  background: rgba(0, 0, 0, 0.06);
}

.huntly-button-group .huntly-icon-button svg {
  width: 16px;
  height: 16px;
}

.huntly-toolbar-action-button {
  width: 30px;
  height: 30px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  background: #fff;
  border-radius: 8px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: background-color 0.2s, border-color 0.2s;
  flex-shrink: 0;
}

.huntly-toolbar-action-button:hover {
  background: rgba(0, 0, 0, 0.04);
  border-color: rgba(0, 0, 0, 0.2);
}

.huntly-toolbar-action-button svg {
  width: 18px;
  height: 18px;
  color: #666;
}

/* Parser selector */
.huntly-parser-selector {
  display: flex;
  align-items: center;
  gap: 8px;
}

.huntly-parser-label {
  font-size: 12px;
  color: #666;
  white-space: nowrap;
  font-weight: 500;
}

.huntly-parser-select {
  padding: 5px 24px 5px 10px;
  font-size: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  background: #fafafa url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E") no-repeat right 8px center;
  cursor: pointer;
  outline: none;
  min-width: 100px;
  color: #333;
  transition: border-color 0.2s, background-color 0.2s;
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
}

.huntly-parser-select:hover {
  border-color: #bbb;
  background-color: #f5f5f5;
}

.huntly-parser-select:focus {
  border-color: #1976d2;
  box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.15);
}

/* Detail button */
.huntly-detail-button {
  height: 30px;
  padding: 0 12px;
  border: 1px solid rgba(0, 0, 0, 0.25);
  background: #fff;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.2s, background-color 0.2s, color 0.2s;
  flex-shrink: 0;
  box-shadow: none;
  color: #333;
  font-size: 13px;
  font-weight: 500;
  line-height: 1;
}

.huntly-detail-button:hover {
  border-color: #1976d2;
  background: rgba(25, 118, 210, 0.04);
  color: #0d47a1;
}

/* Icon button (for edit, etc.) */
.huntly-icon-button {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
  flex-shrink: 0;
}

.huntly-icon-button:hover {
  background: rgba(0, 0, 0, 0.08);
}

.huntly-icon-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.huntly-icon-button svg {
  width: 18px;
  height: 18px;
  color: #666;
}

.huntly-icon-spin {
  animation: huntly-spin 1s linear infinite;
}

@keyframes huntly-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Edit drawer backdrop - click to close */
.huntly-edit-drawer-backdrop {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1299;
  background: transparent;
}

/* Inline edit drawer */
.huntly-edit-drawer {
  position: absolute;
  top: 70px;
  right: 16px;
  height: auto;
  max-height: min(640px, calc(100% - 86px));
  width: 600px;
  max-width: calc(100% - 32px);
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  z-index: 1300;
  display: flex;
  flex-direction: column;
  padding: 14px;
  gap: 10px;
  backdrop-filter: blur(8px);
  overflow-y: auto;
}

.huntly-edit-panel-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.huntly-edit-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-height: 220px;
  color: #6b7280;
  font-size: 13px;
}

.huntly-edit-drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.huntly-edit-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
}

.huntly-edit-alert {
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 12px;
}

.huntly-edit-alert-error {
  color: #991b1b;
  background: #fef2f2;
  border: 1px solid #fecaca;
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
  margin: 0 0 .67em 0;
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
