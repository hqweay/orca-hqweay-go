import { Block } from "../orca";
import { ensureBlockInState, getRepr } from "../libs/utils";
import { MarkdownResult } from "./types";

/**
 * Pure domain logic module for converting a Block to Markdown.
 * - Calls orca.converters
 * - Extracts title from first line
 * - Resolves all tags via refs (using ensureBlockInState when necessary)
 * NO network requests or settings knowledge.
 */
export async function extract(block: Block): Promise<MarkdownResult> {
  // 1. Generate Raw Markdown
  const repr = getRepr(block);
  let mdContent = "";
  try {
    mdContent = await orca.converters.blockConvert(
      "markdown",
      block,
      repr,
      undefined,
      true,
    ) || "";
  } catch (e) {
    console.error("blockConvert failed", e);
  }

  // 2. Extract Title
  const lines = mdContent.split("\n");
  const firstLine = lines[0] || "";
  const title = firstLine.replace(/#+\s*/, "").trim() || "Untitled";

  if (lines.length > 0) {
    lines.shift();
    mdContent = lines.join("\n").trim();
  }

  // 3. Extract all tags
  let tagList: string[] = [];
  if (block.refs && block.refs.length > 0) {
    const tagPromises = block.refs.map(async (ref) => {
      if (ref.alias) return ref.alias;
      const refBlock = await ensureBlockInState(ref.to);
      return refBlock?.text || "";
    });

    const resolvedTags = await Promise.all(tagPromises);
    tagList = resolvedTags
      .filter((t) => t)
      .map((t) => t.trim());
  }

  return {
    markdown: mdContent,
    title,
    tags: tagList,
  };
}
