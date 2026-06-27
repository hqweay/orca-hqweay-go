export type LinkEvaluator = (ref: { type: number; alias?: string }) => boolean;

export function createLinkEvaluator(
  filters: { showTags: boolean; showReferences: boolean },
  excludedTags: string[]
): LinkEvaluator {
  const excludedSet = new Set(
    excludedTags.map((t) => t.trim().toLowerCase()).filter(Boolean)
  );

  return (ref) => {
    if (ref.alias && excludedSet.has(ref.alias.toLowerCase())) return false;
    if (!filters.showTags && ref.type === 2) return false;
    if (!filters.showReferences && ref.type !== 2) return false;
    return true;
  };
}
