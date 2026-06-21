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
