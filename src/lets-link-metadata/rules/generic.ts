import { Rule } from "../types";

export const defaultGeneric: Rule = {
  id: "default-generic",
  name: "Generic Example",
  urlPattern: ".*",
  tagName: "Bookmark",
  downloadCover: false,
  script: `
  // Just return the generic metadata calculated by the system
  // Map baseMeta (flat object) to MetadataProperty[]
  
  return [
    { name: "链接", type: PropType.Text, value: url, typeArgs: { subType: "link" } },
    { name: "标题", type: PropType.Text, value: baseMeta.title || "" },
    { name: "封面", type: PropType.Text, value: baseMeta.thumbnail || "", typeArgs: { subType: "image" } },
    { name: "描述", type: PropType.Text, value: baseMeta.description || "" }
  ];
`.split("\n"),
  enabled: true,
};
export default defaultGeneric;
