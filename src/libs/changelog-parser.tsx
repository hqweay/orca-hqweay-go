import React from "react";

export interface ChangelogEntry {
  version: string;
  sections: {
    title: string;
    items: string[];
  }[];
}

export function parseChangelog(markdown: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];
  const lines = markdown.split("\n");

  let currentEntry: ChangelogEntry | null = null;
  let currentSection: { title: string; items: string[] } | null = null;

  for (const line of lines) {
    const versionMatch = line.match(/^## v?(\d+\.\d+\.\d+)/);
    if (versionMatch) {
      if (currentEntry) {
        if (currentSection) {
          currentEntry.sections.push(currentSection);
        }
        entries.push(currentEntry);
      }
      currentEntry = {
        version: versionMatch[1],
        sections: [],
      };
      currentSection = null;
      continue;
    }

    const sectionMatch = line.match(/^### (.+)/);
    if (sectionMatch && currentEntry) {
      if (currentSection) {
        currentEntry.sections.push(currentSection);
      }
      currentSection = {
        title: sectionMatch[1],
        items: [],
      };
      continue;
    }

    const itemMatch = line.match(/^\s*-\s+(.+)/);
    if (itemMatch && currentSection) {
      const cleanedItem = itemMatch[1]
        .replace(/^[a-f0-9]{4,}:\s*/, "") // 移除 hash
        .replace(/^-\s*/, "")           // 移除多余的 `- `
        .replace(/^###\s*/, "");        // 移除嵌入的 ### 标题前缀
      currentSection.items.push(cleanedItem);
    }
  }

  if (currentEntry) {
    if (currentSection) {
      currentEntry.sections.push(currentSection);
    }
    entries.push(currentEntry);
  }

  return entries;
}

type MarkdownAST = (string | { bold?: string; code?: string; link?: { text: string; url: string } })[];

function parseInlineMarkdown(text: string): React.ReactNode[] {
  const regex = /(\*\*(.+?)\*\*)|(`(.+?)`)|(\[(.+?)\]\((.+?)\))/g;
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    if (match[1]) {
      nodes.push(<strong key={key++}>{match[2]}</strong>);
    } else if (match[3]) {
      nodes.push(<code key={key++}>{match[4]}</code>);
    } else if (match[5]) {
      nodes.push(<a key={key++} href={match[7]}>{match[6]}</a>);
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

export function renderMarkdownItem(text: string): React.ReactNode {
  const cleanText = text.replace(/^###\s*/, "");
  if (!cleanText) return null;
  const nodes = parseInlineMarkdown(cleanText);
  return nodes.length === 1 && typeof nodes[0] === "string" ? nodes[0] : nodes;
}

export function getChangesSinceVersion(
  entries: ChangelogEntry[],
  lastVersion: string
): ChangelogEntry[] {
  const idx = entries.findIndex((e) => e.version === lastVersion);
  if (idx === -1) return entries;
  return entries.slice(0, idx);
}
