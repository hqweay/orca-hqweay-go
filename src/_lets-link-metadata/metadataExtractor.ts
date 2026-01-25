import { MetadataProperty } from "./types";
import { PropType } from "@/libs/consts";

const cleanUrl = (url: string) => url.split("?")[0].split("#")[0];

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
    const baseMeta = getGenericMetadata(doc, cleanedUrl);

    // Join script lines
    const scriptBody = script.join("\n");

    // Create a function from the script string
    // Arguments: doc, url, PropType, cleanUrl, baseMeta
    const extractorFn = new Function(
      "doc",
      "url",
      "PropType",
      "cleanUrl",
      "baseMeta",
      scriptBody,
    );

    // Execute the script
    const result = extractorFn(doc, cleanedUrl, PropType, cleanUrl, baseMeta);

    // Ensure result is array
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
