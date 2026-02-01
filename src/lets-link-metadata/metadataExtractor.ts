import { MetadataProperty, Rule } from "./types";
import { PropType } from "@/libs/consts";
import { HTML_TO_MARKDOWN_SCRIPT, cleanUrl } from "./webviewScripts";

// cleanUrl is imported from ./webviewScripts

export function matchRule(url: string, rules: Rule[]): Rule | undefined {
  return rules.find((rule: Rule) => {
    if (!rule.enabled) return false;
    try {
      let regex: RegExp;
      const pattern = rule.urlPattern.trim();

      // Check if it's a regex literal string like "/pattern/i"
      if (pattern.startsWith("/") && pattern.lastIndexOf("/") > 0) {
        const lastSlashIndex = pattern.lastIndexOf("/");
        const body = pattern.substring(1, lastSlashIndex);
        const flags = pattern.substring(lastSlashIndex + 1);
        regex = new RegExp(body, flags);
      } else {
        // Legacy/Simple string support
        regex = new RegExp(pattern, "i");
      }

      return regex.test(url);
    } catch (e) {
      console.error(`Invalid regex for rule ${rule.name}`, e);
      return false;
    }
  });
}

export async function extractMetadata(
  url: string,
  script: string[],
): Promise<MetadataProperty[]> {
  try {
    const fetchOptions: RequestInit = {
      mode: "cors",
      credentials: "include",
      referrer: new URL(url).origin,
      redirect: "follow", // Let fetch handle redirects
      headers: {
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "accept-language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7",
        // Removed complex sec-ch-ua headers and Douban cookies
        "upgrade-insecure-requests": "1",
      },
    };

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      console.warn(`Fetch error: ${response.status}`);
      // Depending on requirements, we might want to throw or return empty
      // The original code warned and proceeded, but usually fetch failure means no HTML.
      // Let's trying reading text anyway, or throw if critical.
      // Original code: if (!response.ok) warn. Then await response.text().
      // If response is not ok, text() might be error page.
      if (response.status >= 400) {
        // Treat 4xx/5xx as failure enough to maybe not give good metadata?
        // But let's follow original flow: warn and try to parse.
      }
    }

    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const cleanedUrl = cleanUrl(url);

    // 1. Extract Generic Metadata (Base)
    const baseMetaResults = getGenericMetadata(doc, cleanedUrl);
    // Convert array of MetadataProperty to a flat object for baseMeta
    const baseMeta: any = {};
    baseMetaResults.forEach((p) => {
      if (p.name === "标题") baseMeta.title = p.value;
      if (p.name === "封面") baseMeta.thumbnail = p.value;
    });

    // Join script lines
    const scriptBody = script.join("\n");

    // Create a function from the script string
    // Arguments: doc, url, PropType, cleanUrl, baseMeta, htmlToMarkdown
    const extractorFn = new Function(
      "doc",
      "url",
      "PropType",
      "cleanUrl",
      "baseMeta",
      "htmlToMarkdown",
      HTML_TO_MARKDOWN_SCRIPT + scriptBody,
    );

    // Execute the script
    const result = extractorFn(
      doc,
      cleanedUrl,
      PropType,
      cleanUrl,
      baseMeta,
      null, // htmlToMarkdown is defined inside the script body via HTML_TO_MARKDOWN_SCRIPT prefix
    ); // Ensure result is array
    if (!Array.isArray(result)) {
      console.warn("Script returned non-array:", result);
      return [];
    }

    return result as MetadataProperty[];
  } catch (error) {
    console.error("Failed to extract metadata:", error);
    throw error;
  }
}

function getGenericMetadata(doc: Document, url: string): MetadataProperty[] {
  const title =
    doc
      .querySelector("meta[property='og:title']")
      ?.getAttribute("content")
      ?.trim() ||
    doc.querySelector("title")?.textContent?.trim() ||
    "";

  const thumbnail =
    doc.querySelector("meta[property='og:image']")?.getAttribute("content") ||
    doc.querySelector("meta[name='og:image']")?.getAttribute("content") ||
    doc.querySelector("link[rel='icon']")?.getAttribute("href") ||
    "";

  return [
    {
      name: "链接",
      type: PropType.Text,
      value: url,
      typeArgs: { subType: "link" },
    },
    {
      name: "标题",
      type: PropType.Text,
      value: title,
    },
    {
      name: "封面",
      type: PropType.Text,
      typeArgs: { subType: "image" },
      value: thumbnail,
    },
  ];
}
