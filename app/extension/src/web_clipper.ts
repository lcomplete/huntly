import {isProbablyReaderable, Readability} from "@mozilla/readability";
import {findSmallestFaviconUrl, getBaseURI, isNotBlank, toAbsoluteURI} from "./utils";
import {log} from "./logger";
import {readSyncStorageSettings} from "./storage";

log("web clipper script loaded");

chrome.runtime.onMessage.addListener(function (msg: Message, sender, sendResponse) {
  if (document.domain === "twitter.com") {
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

class WebClipper {

  autoSavePureRead(saveSetting: AutoSaveSetting) {
    if (!this.isMaybeReadable(saveSetting)) {
      return;
    }

    this.savePureRead(true);
  }

  isMaybeReadable(saveSetting: AutoSaveSetting) {
    const huntlyMeta = document.querySelector("meta[data-huntly='1']"); // exclude huntly web app
    return !huntlyMeta && isProbablyReaderable(document, {
      minScore: saveSetting.minScore,
      minContentLength: saveSetting.minContentLength
    });
  }

  savePureRead(autoSave = false) {
    const documentClone = document.cloneNode(true) as Document;
    const baseURI = getBaseURI(documentClone);
    const documentURI = documentClone.documentURI;
    const article = new Readability(documentClone, {debug: false}).parse();

    const ogImage = documentClone.querySelector("meta[property='og:image']");
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

    const ogTitle = documentClone.querySelector("meta[property='og:title']");
    const title = ogTitle ? ogTitle.getAttribute("content") : "";

    let faviconUrl = findSmallestFaviconUrl(documentClone);

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
        // pass auto_save_clipper flat to background script, so that it can check the blacklist
        chrome.runtime.sendMessage<Message>({
          type: autoSave ? "auto_save_clipper" : "save_clipper",
          payload: page
        });
      }
    }
  }

  verifyPage(page: PageModel) {
    return isNotBlank(page.title) && isNotBlank(page.content) && isNotBlank(page.url) && isNotBlank(page.description);
  }

}