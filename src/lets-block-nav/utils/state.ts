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
  hideBuiltInToc: boolean;
}

export let __blockNavScrollTop = 0;
export const setBlockNavScrollTop = (v: number) => { __blockNavScrollTop = v; };

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
  hideBuiltInToc: false,
});

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
