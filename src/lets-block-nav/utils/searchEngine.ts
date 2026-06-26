import { blockNavState } from "./state";
import { getBlockTitle as getBlockTitleUtil, getRepr } from "../../libs/utils";
import { parseSearchQuery, matchFilters } from "./searchParser";

// A plain object to hold the massive tree data, avoiding Valtio deep proxy crashes
let searchCache = {
  tree: null as any[] | null,
  rootId: null as number | null,
  map: new Map<number, any>(),
};

export const getSearchCacheBlock = (blockId: number) => {
  return searchCache.map.get(blockId);
};

export const clearSearchCache = () => {
  searchCache.tree = null;
  searchCache.rootId = null;
  searchCache.map.clear();
};

export const ensureSearchTree = async (rootId: number) => {
  if (!searchCache.tree || searchCache.rootId !== rootId) {
    try {
      const blockTree = await orca.invokeBackend("get-block-tree", rootId);
      if (!blockTree || !Array.isArray(blockTree)) return false;

      searchCache.tree = blockTree;
      searchCache.rootId = rootId;
      searchCache.map.clear();
      for (const b of blockTree) {
        searchCache.map.set(b.id, b);
      }
      return true;
    } catch (e) {
      console.error("[BlockNavSearchEngine] Failed to fetch block tree", e);
      return false;
    }
  }
  return true;
};

export const executeSearch = async (text: string, rootId: number) => {
  blockNavState.filterText = text;
  const parsed = parseSearchQuery(text);

  // If no raw text and no filters, exit search mode
  if (!parsed.rawText && parsed.filters.length === 0) {
    blockNavState.isSearching = false;
    blockNavState.searchMatchedIds = {};
    blockNavState.searchExpandedIds = {};
    return;
  }

  if (!rootId) return;
  
  blockNavState.isSearching = true;

  const success = await ensureSearchTree(rootId);
  if (!success || !searchCache.tree) return;

  const matchedIds: Record<number, boolean> = {};
  const expandedIds: Record<number, boolean> = {};
  const lowerText = parsed.rawText.toLowerCase();

  for (const cachedBlock of searchCache.tree) {
    // Use live block state if available, ensuring edits from the main editor
    // are accurately reflected during search without refetching the entire tree.
    const block = orca.state.blocks[cachedBlock.id] || cachedBlock;

    let blockText = "";
    try {
      const title = getBlockTitleUtil(block, block.id, 0);
      if (typeof title === "string") {
        blockText = title.toLowerCase();
      }
    } catch (e) {
      // Ignore extraction errors
    }

    const textMatched = !lowerText || blockText.includes(lowerText);
    const filterMatched = matchFilters(block, parsed.filters, getRepr);

    if (textMatched && filterMatched) {
      matchedIds[block.id] = true;

      let current = block.parent;
      let loopCount = 0;
      while (current && searchCache.map.has(Number(current))) {
        loopCount++;
        if (loopCount > 1000) {
          console.error(
            "[BlockNavSearchEngine] FATAL: infinite loop detected during parent traversal!",
          );
          break;
        }
        const currentId = Number(current);
        if (expandedIds[currentId]) break; // Already expanded this path, or hit a circular reference!

        expandedIds[currentId] = true;
        current = searchCache.map.get(currentId).parent;

        // Absolute safeguard against node pointing to itself
        if (current == currentId) break;
      }
    }
  }

  try {
    blockNavState.searchMatchedIds = matchedIds;
    blockNavState.searchExpandedIds = expandedIds;
  } catch (e) {
    console.error("[BlockNavSearchEngine] CRASH while assigning proxy!", e);
  }
};

export const executeSnapshotExpand = async (
  targetDepth: number | "all" | "All",
) => {
  const rootId = blockNavState.rootBlockId;
  if (!rootId) return;

  const success = await ensureSearchTree(rootId);
  if (!success || !searchCache.tree) return;

  const newExpandedIds: Record<number, boolean> = {};

  if (targetDepth === "all" || targetDepth === "All") {
    for (const b of searchCache.tree) {
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

export const updateCacheAndRetrigger = (
  blockId: number,
  updater: (block: any) => void,
  currentFilterText: string,
) => {
  const cachedBlock = searchCache.map.get(blockId);
  if (cachedBlock) {
    updater(cachedBlock);
  }
  
  if (currentFilterText && blockNavState.rootBlockId) {
    executeSearch(currentFilterText, blockNavState.rootBlockId);
  }
};
