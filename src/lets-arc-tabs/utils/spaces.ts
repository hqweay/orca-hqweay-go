import { arcTabsState } from "./data";

const getSpaceProperty = (block: any): string[] => {
  const prop = block.properties?.find((p: any) => p.name === "Space");
  return prop?.value || [];
};

export const getSpaces = (): string[] => {
  const spaces = new Set<string>();
  for (const block of arcTabsState.pinnedBlocks) {
    getSpaceProperty(block).forEach((s: string) => spaces.add(s));
  }
  return Array.from(spaces).sort();
};

export const getBlocksInSpace = (space: string): any[] => {
  return arcTabsState.pinnedBlocks.filter((b) =>
    getSpaceProperty(b).includes(space)
  );
};

export const getUnassignedBlocks = (): any[] => {
  return arcTabsState.pinnedBlocks.filter(
    (b) => getSpaceProperty(b).length === 0
  );
};

export const getSpacePropertyForBlock = (blockId: number): string[] => {
  const block = arcTabsState.pinnedBlocks.find((b) => b.id === blockId);
  return block ? getSpaceProperty(block) : [];
};
