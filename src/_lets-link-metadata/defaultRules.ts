import { Rule } from "./types";

export const DEFAULT_RULES: Rule[] = [
  {
    id: "default-generic",
    name: "Generic Example",
    urlPattern: ".*",
    tagName: "Bookmark",
    script: `
  // Just return the generic metadata calculated by the system
  return baseMeta;
`.split("\n"),
    enabled: true,
  },
];
