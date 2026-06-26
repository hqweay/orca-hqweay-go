import { pinyin } from "pinyin-pro";
import { format } from "date-fns";
import { ImageLink } from "./types";

export function generateSlug(title: string, blockId: number): string {
  if (title && title !== "Untitled") {
    // Convert to pinyin: '你好 world' -> 'ni-hao-world'
    const pinyinTitle = pinyin(title, {
      toneType: "none",
      v: true,
      nonZh: "consecutive", // Merge non-Chinese characters
      separator: "-", // Join with dashes
    })
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "") // Remove special chars (keep spaces and dashes)
      .trim()
      .replace(/\s+/g, "-") // Replace remaining spaces with dashes
      .replace(/-+/g, "-"); // Collapse multiple dashes

    return `${pinyinTitle}-${blockId}`;
  }
  return format(new Date(), "yyyyMMddHHmmss");
}

export function extractImageLinks(markdown: string): ImageLink[] {
  const regex = /!\[(.*?)\]\((.*?)\)/g;
  const matches: ImageLink[] = [];
  let match;
  while ((match = regex.exec(markdown)) !== null) {
    matches.push({
      fullMatch: match[0],
      alt: match[1],
      url: match[2],
    });
  }
  return matches;
}

export function replaceImageUrl(
  markdown: string,
  fullMatch: string,
  alt: string,
  newUrl: string,
): string {
  return markdown.split(fullMatch).join(`![${alt}](${newUrl})`);
}

export function toBase64(str: string): string {
  // Handle UTF-8 strings
  return window.btoa(unescape(encodeURIComponent(str)));
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}
