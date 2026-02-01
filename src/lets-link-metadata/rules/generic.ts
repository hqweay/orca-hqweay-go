import { Rule } from "../types";

export const defaultGeneric: Rule = {
  id: "default-generic",
  name: "Generic Example",
  urlPattern: ".*",
  tagName: "Bookmark",
  downloadCover: false,
  script: `
  // 1. Generic Metadata
  return [
    { name: "链接", type: PropType.Text, value: cleanUrl(url), typeArgs: { subType: "link" } },
    { name: "域名", type: PropType.Text, value: new URL(url).origin, typeArgs: { subType: "link" } },
    { name: "标题", type: PropType.Text, value: baseMeta.title || "" },
    { name: "封面", type: PropType.Text, value: baseMeta.thumbnail || "", typeArgs: { subType: "image" } },
    { name: "描述", type: PropType.Text, value: baseMeta.description || "" }
  ];
`.split("\n"),
  contentScript: `
  // 2. Simple Heuristic Content Extraction
  const selectors = ['article', 'main', '.article', '.post-content', '.entry-content', '#content'];
  let target = null;
  let maxLen = 0;
  
  for (const s of selectors) {
    const elements = doc.querySelectorAll(s);
    elements.forEach(el => {
      const len = el.innerText.length;
      if (len > maxLen) {
        maxLen = len;
        target = el;
      }
    });
  }
  
  if (!target || maxLen < 200) {
    target = doc.body;
  }
  
  // 3. Use injected HTML to Markdown Converter
  const markdown = htmlToMarkdown(target)
    .replace(/\\n{3,}/g, "\\n\\n") // Clean up extra newlines
    .trim();
  
  return [{ name: "正文", type: PropType.Text, value: markdown }];
`.split("\n"),
  enabled: true,
};
export default defaultGeneric;
