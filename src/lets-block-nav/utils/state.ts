import { proxy } from "valtio";

export interface BlockNavState {
  rootBlockId: number | null;
  expandedIds: Set<number>;
  lastActiveEditorPanelId: string | null;
}

export const blockNavState = proxy<BlockNavState>({
  rootBlockId: null,
  expandedIds: new Set<number>(),
  lastActiveEditorPanelId: null,
});

export const setRootBlock = (blockId: number | null) => {
  blockNavState.rootBlockId = blockId;
};

export const toggleNodeExpansion = (blockId: number) => {
  if (blockNavState.expandedIds.has(blockId)) {
    blockNavState.expandedIds.delete(blockId);
  } else {
    blockNavState.expandedIds.add(blockId);
  }
};
