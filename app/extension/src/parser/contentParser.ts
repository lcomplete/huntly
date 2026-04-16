import { Readability } from "@mozilla/readability";
import Defuddle from "defuddle";
import { log } from "../logger";
import { ContentParserType } from "../storage";

export interface ParsedArticle {
  title: string;
  content: string;
  excerpt: string;
  byline: string;
  siteName: string;
}

/**
 * Parse document content using the specified parser
 * @param doc - The document to parse (should be a cloned document)
 * @param parserType - The parser to use: "readability" or "defuddle"
 * @returns Parsed article or null if parsing fails
 */
export function parseDocument(
  doc: Document,
  parserType: ContentParserType = "readability"
): ParsedArticle | null {
  if (parserType === "defuddle") {
    return parseWithDefuddle(doc);
  }
  return parseWithReadability(doc);
}

/**
 * Extract excerpt from HTML content
 * @param html - The HTML content
 * @param maxLength - Maximum length of excerpt (default 200)
 */
function extractExcerptFromContent(html: string, maxLength: number = 200): string {
  if (!html) return "";
  // Create a temporary element to parse HTML
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = html;
  // Get text content and clean up whitespace
  const text = (tempDiv.textContent || tempDiv.innerText || "")
    .replace(/\s+/g, " ")
    .trim();
  // Return truncated text
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + "...";
}

/**
 * Parse document using Mozilla Readability
 */
function parseWithReadability(doc: Document): ParsedArticle | null {
  try {
    log("[Huntly] parseWithReadability: starting, doc.documentElement exists:", !!doc.documentElement);
    const article = new Readability(doc, { debug: false }).parse();
    if (!article) {
      log("[Huntly] parseWithReadability: Readability returned null");
      return null;
    }
    log("[Huntly] parseWithReadability: article found, title:", article.title, "contentLen:", article.content?.length, "excerpt:", article.excerpt?.substring(0, 50));
    // Ensure excerpt has a fallback value from content
    const excerpt = article.excerpt || extractExcerptFromContent(article.content || "");
    return {
      title: article.title || "",
      content: article.content || "",
      excerpt,
      byline: article.byline || "",
      siteName: article.siteName || "",
    };
  } catch (error) {
    console.error("Readability parsing error:", error);
    return null;
  }
}

/**
 * Parse document using Defuddle
 */
function parseWithDefuddle(doc: Document): ParsedArticle | null {
  try {
    const defuddle = new Defuddle(doc);
    const result = defuddle.parse();
    if (!result || !result.content) {
      return null;
    }
    // Ensure excerpt has a fallback value from content
    const excerpt = result.description || extractExcerptFromContent(result.content || "");
    return {
      title: result.title || "",
      content: result.content || "",
      excerpt,
      byline: result.author || "",
      siteName: result.site || "",
    };
  } catch (error) {
    console.error("Defuddle parsing error:", error);
    return null;
  }
}

