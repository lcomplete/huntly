import { Readability } from "@mozilla/readability";
import Defuddle from "defuddle";
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
 * Parse document using Mozilla Readability
 */
function parseWithReadability(doc: Document): ParsedArticle | null {
  const article = new Readability(doc, { debug: false }).parse();
  if (!article) {
    return null;
  }
  return {
    title: article.title || "",
    content: article.content || "",
    excerpt: article.excerpt || "",
    byline: article.byline || "",
    siteName: article.siteName || "",
  };
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
    return {
      title: result.title || "",
      content: result.content || "",
      excerpt: result.description || "",
      byline: result.author || "",
      siteName: result.site || "",
    };
  } catch (error) {
    console.error("Defuddle parsing error:", error);
    return null;
  }
}

