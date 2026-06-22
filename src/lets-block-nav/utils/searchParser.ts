export interface ParsedSearch {
  rawText: string;
  filters: string[];
}

export function parseSearchQuery(query: string): ParsedSearch {
  if (!query) {
    return { rawText: "", filters: [] };
  }

  const filters: string[] = [];

  // Regex to match "is:word" syntax, capturing the "word"
  const filterRegex = /is:([a-zA-Z0-9_-]+)/g;

  let match;
  while ((match = filterRegex.exec(query)) !== null) {
    filters.push(match[1].toLowerCase());
  }

  // Remove the "is:word" tokens from the original query to get the clean search text
  const rawText = query.replace(filterRegex, "").trim();

  return { rawText, filters };
}

// Check if a given block matches the active filters
export function matchFilters(
  block: any,
  filters: string[],
  getRepr: (b: any) => any,
): boolean {
  if (filters.length === 0) return true; // No filters active, match all

  const repr = getRepr(block);

  for (const filter of filters) {
    if (filter === "heading") {
      if (repr?.type === "heading") return true;
    } else if (filter === "task") {
      if (repr?.type === "task") return true;
    } else if (filter === "todo") {
      if (repr?.type === "task" && repr?.state !== 1) return true;
    } else if (filter === "done") {
      if (repr?.type === "task" && repr?.state === 1) return true;
    }
    // Extensibility: add 'code', 'quote' etc. here later
  }

  // If we have filters but none matched, return false
  return false;
}
