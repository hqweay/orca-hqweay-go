import { proxy } from "valtio";

export interface BlockNavState {
  rootBlockId: number | null;
  expandedIds: Record<number, boolean>;
  lastActiveEditorPanelId: string | null;
  navigatedToBlockId: number | null;
  filterText: string;
  isSearching: boolean;
  searchMatchedIds: Record<number, boolean>;
  searchExpandedIds: Record<number, boolean>;
  resolvedJournalBlockIds: Record<string, number>;
  searchTrigger: number;
  hideBuiltInToc: boolean;
}

export const blockNavState = proxy<BlockNavState>({
  rootBlockId: null,
  expandedIds: {},
  lastActiveEditorPanelId: null,
  navigatedToBlockId: null,
  filterText: "",
  isSearching: false,
  searchMatchedIds: {},
  searchExpandedIds: {},
  resolvedJournalBlockIds: {},
  searchTrigger: 0,
  hideBuiltInToc: false,
});

// A plain object to hold the massive tree data, avoiding Valtio deep proxy crashes
export const searchCache = {
  tree: null as any[] | null,
  rootId: null as number | null,
  map: new Map<number, any>(),
};

export const setRootBlock = (blockId: number | null) => {
  blockNavState.rootBlockId = blockId;
};

export const toggleNodeExpansion = (blockId: number) => {
  if (blockNavState.expandedIds[blockId]) {
    delete blockNavState.expandedIds[blockId];
  } else {
    blockNavState.expandedIds[blockId] = true;
  }
};

export const executeSnapshotExpand = async (
  targetDepth: number | "all" | "All",
) => {
  const rootId = blockNavState.rootBlockId;
  if (!rootId) return;

  let blockTree = searchCache.tree;
  if (!blockTree || searchCache.rootId !== rootId) {
    try {
      blockTree = await orca.invokeBackend("get-block-tree", rootId);
      if (!blockTree || !Array.isArray(blockTree)) return;

      searchCache.tree = blockTree;
      searchCache.rootId = rootId;
      searchCache.map.clear();
      for (const b of blockTree) {
        searchCache.map.set(b.id, b);
      }
    } catch (e) {
      console.error("Failed to fetch block tree", e);
      return;
    }
  }

  const newExpandedIds: Record<number, boolean> = {};

  if (targetDepth === "all" || targetDepth === "All") {
    for (const b of blockTree) {
      if (b.children && b.children.length > 0) {
        newExpandedIds[b.id] = true;
      }
    }
  } else {
    const depthMap = new Map<number, number>();
    depthMap.set(rootId, 0);

    const queue = [rootId];
    let i = 0;

    while (i < queue.length) {
      const currentId = queue[i++];
      const currentDepth = depthMap.get(currentId)!;

      if (currentDepth >= targetDepth) {
        continue;
      }

      const node =
        orca.state.blocks[currentId] || searchCache.map.get(currentId);
      if (node && node.children && node.children.length > 0) {
        newExpandedIds[currentId] = true;
        for (const childId of node.children) {
          const cId = Number(childId);
          depthMap.set(cId, currentDepth + 1);
          queue.push(cId);
        }
      }
    }
  }

  blockNavState.expandedIds = newExpandedIds;
};
