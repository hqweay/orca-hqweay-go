import { PropType } from "@/libs/consts";

/**
 * This file contains script snippets that are injected into the webview.
 * They are defined as strings so they can be easily passed via executeJavaScript.
 */

export const HTML_TO_MARKDOWN_SCRIPT = `
  var htmlToMarkdown = (node) => {
    if (!node) return "";
    if (node.nodeType === 3) return node.textContent; // Text node
    if (node.nodeType !== 1) return ""; // Not an element

    const tag = node.tagName.toLowerCase();
    let children = "";
    node.childNodes.forEach(child => children += htmlToMarkdown(child));

    switch (tag) {
      case "img": return "\\n![](" + (node.getAttribute("src") || "") + ")\\n";
      case "script": case "style": case "nav": case "header": case "footer": case "aside": return "";
      case "h1": return "\\n# " + children.trim() + "\\n";
      case "h2": return "\\n## " + children.trim() + "\\n";
      case "h3": return "\\n### " + children.trim() + "\\n";
      case "p": case "div": return "\\n" + children + "\\n";
      case "br": return "\\n";
      case "strong": case "b": return "**" + children + "**";
      case "em": case "i": return "*" + children + "*";
      case "a": return "[" + children.trim() + "](" + (node.getAttribute("href") || "") + ")";
      case "li": return "\\n- " + children.trim();
      case "ul": case "ol": return children + "\\n";
      default: return children;
    }
  };
`;

// Shared cleanUrl implementation
export const cleanUrl = (urlString: string) => {
  try {
    const url = new URL(urlString);
    const paramsToRemove = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "fbclid",
      "gclid",
      "yclid",
      "msclkid",
      "icid",
      "mc_cid",
      "mc_eid",
      "_ga",
      "si",
      "igshid",
      "feature",
      "sharing",
      "app",
      "ref",
      "nr",
      "ncid",
      "cmpid",
      "ito",
      "ved",
      "ei",
      "s",
      "cvid",
      "form",
    ];
    paramsToRemove.forEach((param) => url.searchParams.delete(param));
    return url.toString();
  } catch (e) {
    // Fallback for invalid URLs
    return urlString ? urlString.split("?")[0].split("#")[0] : "";
  }
};

export const CLEAN_URL_SCRIPT = `
  var cleanUrl = ${cleanUrl.toString()};
`;
