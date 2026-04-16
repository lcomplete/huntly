import {isProbablyReaderable} from "@mozilla/readability";
import {findSmallestFaviconUrl, getBaseURI, isNotBlank, toAbsoluteURI} from "./utils";
import {log} from "./logger";
import {ContentParserType, readSyncStorageSettings} from "./storage";
import {parseDocument} from "./parser/contentParser";
import React from "react";
import {ShadowDomPreview} from "./components/ShadowDomPreview";
import {createRoot} from "react-dom/client";

let root: ReturnType<typeof createRoot> | null = null;
// Store last snippet for current page (page-specific, not persisted)
let lastSnippetPage: PageModel | null = null;
// Cache the parser type setting
let cachedParserType: ContentParserType = "readability";
// Preview root element reference
let previewRootEl: HTMLDivElement | null = null;

export function initWebClipper(): void {
  log("[Huntly] initWebClipper called - content script starting");
  log("web clipper script loaded");

  readSyncStorageSettings().then((settings) => {
    cachedParserType = settings.contentParser;
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "sync" && changes.contentParser) {
      cachedParserType = changes.contentParser.newValue;
    }
  });

  chrome.runtime.onMessage.addListener(function (msg: Message, sender, sendResponse) {
    if (msg.type === "parse_doc") {
      try {
        const parserType = msg.payload?.parserType || cachedParserType;
        log("[Huntly] parse_doc received, parserType:", parserType, "url:", location.href);
        const webClipper = new WebClipper(parserType);
        const page = webClipper.parseDoc(document.cloneNode(true) as Document);
        const isHuntlySite = webClipper.hasHuntlyMeta(document);
        log("[Huntly] parse_doc result: page?", !!page, "isHuntlySite:", isHuntlySite);
        sendResponse({page, parserType, isHuntlySite});
      } catch (error) {
        console.error("[Huntly] parse_doc error:", error);
        sendResponse({page: null, parserType: cachedParserType, isHuntlySite: false});
      }
      return;
    } else if (msg.type === 'shortcuts_preview') {
      let page = msg.payload?.page;
      const parserType = msg.payload?.parserType || cachedParserType;
      log('[Huntly] shortcuts_preview - received parserType:', msg.payload?.parserType, 'using:', parserType);
      if (!page) {
        const webClipper = new WebClipper(parserType);
        page = webClipper.parseDoc(document.cloneNode(true) as Document);
      }
      const rootId = "huntly_preview_unique_root";
      let elRoot = document.getElementById(rootId) as HTMLDivElement | null;
      if (!elRoot) {
        elRoot = document.createElement("div");
        elRoot.id = rootId;
        document.body.append(elRoot);
      }

      const originalBodyOverflow = document.body.style.overflow;
      const originalHtmlOverflow = document.documentElement.style.overflow;

      const handleClose = () => {
        if (previewRootEl) {
          delete previewRootEl.dataset.preview;
        }
        if (root) {
          root.unmount();
          root = null;
        }
        document.body.style.overflow = originalBodyOverflow;
        document.documentElement.style.overflow = originalHtmlOverflow;
      };

      if (root) {
        root.unmount();
      }

      elRoot.dataset.preview = "1";
      previewRootEl = elRoot;
      root = createRoot(elRoot);
      root.render(
        <ShadowDomPreview
          page={page}
          initialParserType={parserType}
          onClose={handleClose}
          externalShortcuts={msg.payload?.externalShortcuts}
          externalModels={msg.payload?.externalModels}
          autoExecuteShortcut={msg.payload?.autoExecuteShortcut}
          autoSelectedModel={msg.payload?.autoSelectedModel}
          initialThinkingModeEnabled={msg.payload?.initialThinkingModeEnabled}
        />
      );
      return;
    } else if (msg.type === "get_selection") {
      const webClipper = new WebClipper();
      const selection = window.getSelection();
      let content = "";
      if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
        const range = selection.getRangeAt(0);
        const div = document.createElement('div');
        div.appendChild(range.cloneContents());
        content = div.innerHTML;
      }
      
      if (!content) {
        if (lastSnippetPage) {
          sendResponse({page: lastSnippetPage, isRestored: true});
        } else {
          sendResponse({page: null});
        }
        return;
      }

      const doc = document.cloneNode(true) as Document;
      
      const baseURI = getBaseURI(doc);
      const documentURI = doc.documentURI;
      const ogTitle = doc.querySelector("meta[property='og:title']");
      const title = ogTitle ? ogTitle.getAttribute("content") : doc.title;
      
      const ogImage = doc.querySelector("meta[property='og:image']");
      let thumbUrl = ogImage ? ogImage.getAttribute("content") : null;
      if (thumbUrl) {
        thumbUrl = toAbsoluteURI(thumbUrl, baseURI, documentURI);
      }
      
      const ogSiteName = doc.querySelector("meta[property='og:site_name']");
      const siteName = ogSiteName ? ogSiteName.getAttribute("content") : "";
      
      let faviconUrl = findSmallestFaviconUrl(doc);
      
      const page: PageModel = {
        title: title || "",
        content: content,
        url: location.href,
        thumbUrl: thumbUrl || "",
        description: selection.toString(),
        author: "",
        siteName: siteName,
        language: "",
        category: "",
        isLiked: false,
        isFavorite: false,
        domain: document.domain,
        faviconUrl: faviconUrl || "",
        contentType: 4
      };
      
      lastSnippetPage = page;
      
      sendResponse({page, isRestored: false});
      return;
    }

    if (document.domain === "twitter.com" || document.domain === "x.com") {
      return;
    }
    if (msg.type !== "tab_complete") {
      return;
    }
    readSyncStorageSettings().then((settings) => {
      if (settings.autoSaveEnabled) {
        timeoutSavePureRead();
      }
    });
  });
}

function timeoutSavePureRead() {
  setTimeout(() => {
    const webClipper = new WebClipper(cachedParserType);
    webClipper.autoSavePureRead();
  }, 2000);
}

export class WebClipper {
  private parserType: ContentParserType;

  constructor(parserType: ContentParserType = "readability") {
    this.parserType = parserType;
  }

  autoSavePureRead() {
    if (!this.isMaybeReadable()) {
      return;
    }

    this.savePureRead(true);
  }

  hasHuntlyMeta(doc): boolean {
    // exclude huntly web app
    return !!doc.querySelector("meta[data-huntly='1']");
  }

  isMaybeReadable() {
    return !this.hasHuntlyMeta(document) && isProbablyReaderable(document, {
      minScore: 20,
      minContentLength: 40
    });
  }

  savePureRead(autoSave = false) {
    this.savePureReadDoc(autoSave, document.cloneNode(true) as Document);
  }

  private savePureReadDoc(autoSave: boolean, doc: Document) {
    const page = this.parseDoc(doc);
    if (page != null) {
      // pass auto_save_clipper flat to background script, so that it can check the blacklist
      chrome.runtime.sendMessage<Message>({
        type: autoSave ? "auto_save_clipper" : "save_clipper",
        payload: page
      });
    }
  }

  parseDoc(doc: Document): PageModel {
    const baseURI = getBaseURI(doc);
    const documentURI = doc.documentURI;
    const article = parseDocument(doc, this.parserType);

    const ogImage = doc.querySelector("meta[property='og:image']");
    let thumbUrl = ogImage ? ogImage.getAttribute("content") : null;
    if (!thumbUrl && article) {
      const domParser = new DOMParser();
      const domArticle = domParser.parseFromString(article.content, "text/html");
      const firstImage = domArticle.querySelector("img");
      thumbUrl = firstImage ? firstImage.getAttribute("src") : null;
    }
    if (thumbUrl) {
      thumbUrl = toAbsoluteURI(thumbUrl || "", baseURI, documentURI);
    }

    const ogTitle = doc.querySelector("meta[property='og:title']");
    const title = ogTitle ? ogTitle.getAttribute("content") : "";

    let faviconUrl = findSmallestFaviconUrl(doc);

    if (article) {
      const page: PageModel = {
        title: title || article.title,
        content: article.content,
        url: location.href,
        thumbUrl: thumbUrl || "",
        description: article.excerpt,
        author: article.byline || "",
        siteName: article.siteName,
        language: "",
        category: "",
        isLiked: false,
        isFavorite: false,
        domain: document.domain,
        faviconUrl: faviconUrl || "",
      }

      if (this.verifyPage(page)) {
        return page;
      } else {
        log("[Huntly] parseDoc: verifyPage failed.",
          "title:", isNotBlank(page.title), `"${page.title?.substring(0, 30)}"`,
          "content:", isNotBlank(page.content), `len=${page.content?.length}`,
          "url:", isNotBlank(page.url), `"${page.url}"`,
          "desc:", isNotBlank(page.description), `"${page.description?.substring(0, 50)}"`);
      }
    } else {
      log("[Huntly] parseDoc: parseDocument returned null/undefined");
    }
  }

  verifyPage(page: PageModel) {
    return isNotBlank(page.title) && isNotBlank(page.content) && isNotBlank(page.url) && isNotBlank(page.description);
  }

}
