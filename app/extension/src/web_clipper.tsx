import {isProbablyReaderable, Readability} from "@mozilla/readability";
import {findSmallestFaviconUrl, getBaseURI, isNotBlank, toAbsoluteURI} from "./utils";
import {log} from "./logger";
import {readSyncStorageSettings} from "./storage";
import React from "react";
import Article from "./article";
import {createRoot} from "react-dom/client";

log("web clipper script loaded");

let root = null;
// Store last snippet for current page (page-specific, not persisted)
let lastSnippetPage: PageModel | null = null;

chrome.runtime.onMessage.addListener(function (msg: Message, sender, sendResponse) {
  if (msg.type === "parse_doc") {
    const webClipper = new WebClipper()
    const page = webClipper.parseDoc(document.cloneNode(true) as Document);
    sendResponse({page});
    return;
  } else if (msg.type === 'shortcuts_preview') {
    let page = msg.payload?.page;
    if (!page) {
      const webClipper = new WebClipper();
      page = webClipper.parseDoc(document.cloneNode(true) as Document);
    }
    const rootId = "huntly_preview_unique_root";
    let elRoot = document.getElementById(rootId);
    if (!elRoot) {
      const elPreview = document.createElement("div");
      elPreview.setAttribute("id", rootId);
      document.body.append(elPreview);
      elRoot = elPreview;
    }
    if (elRoot.getAttribute("data-preview") !== "1") {
      elRoot.setAttribute("data-preview", "1");
      if (!root) {
        root = createRoot(elRoot);
      } else {
        root.unmount();
        root = createRoot(elRoot);
      }
      root.render(
        <Article page={page} shortcuts={msg.payload?.shortcuts || []}/>
      );
    }
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
      // No new selection, return last snippet if exists (with isRestored flag)
      if (lastSnippetPage) {
        sendResponse({page: lastSnippetPage, isRestored: true});
      } else {
        sendResponse({page: null});
      }
      return;
    }

    const doc = document.cloneNode(true) as Document;
    
    // Extract metadata without Readability
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
      author: "", // Could try to find author meta tag
      siteName: siteName,
      language: "",
      category: "",
      isLiked: false,
      isFavorite: false,
      domain: document.domain,
      faviconUrl: faviconUrl || "",
      contentType: 4 // SNIPPET
    };
    
    // Save as last snippet for this page
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
      timeoutSavePureRead({minScore: settings.autoSaveMinScore, minContentLength: settings.autoSaveMinContentLength});
    }
  });
});

type AutoSaveSetting = {
  minScore: number,
  minContentLength: number
}

function timeoutSavePureRead(saveSetting: AutoSaveSetting) {
  setTimeout(() => {
    const webClipper = new WebClipper()
    webClipper.autoSavePureRead(saveSetting);
  }, 2000);
}

export class WebClipper {

  autoSavePureRead(saveSetting: AutoSaveSetting) {
    if (!this.isMaybeReadable(saveSetting)) {
      return;
    }

    this.savePureRead(true);
  }

  hasHuntlyMeta(doc) {
    // exclude huntly web app
    return doc.querySelector("meta[data-huntly='1']");
  }

  isMaybeReadable(saveSetting: AutoSaveSetting) {
    return !this.hasHuntlyMeta(document) && isProbablyReaderable(document, {
      minScore: saveSetting.minScore,
      minContentLength: saveSetting.minContentLength
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
    if (this.hasHuntlyMeta(doc)) {
      return null;
    }

    const baseURI = getBaseURI(doc);
    const documentURI = doc.documentURI;
    const article = new Readability(doc, {debug: false}).parse();

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
      }
    }
  }

  verifyPage(page: PageModel) {
    return isNotBlank(page.title) && isNotBlank(page.content) && isNotBlank(page.url) && isNotBlank(page.description);
  }

}