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

    const itemMatch = line.match(/^- (.+)/);
    if (itemMatch && currentSection) {
      currentSection.items.push(itemMatch[1]);
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

export function getChangesSinceVersion(
  entries: ChangelogEntry[],
  lastVersion: string
): ChangelogEntry[] {
  const idx = entries.findIndex((e) => e.version === lastVersion);
  if (idx === -1) return entries;
  return entries.slice(0, idx);
}
