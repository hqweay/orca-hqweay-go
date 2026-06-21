import { proxy } from "valtio";

export interface BlockNavState {
  rootBlockId: number | null;
  expandedIds: Record<number, boolean>;
  lastActiveEditorPanelId: string | null;
}

export const blockNavState = proxy<BlockNavState>({
  rootBlockId: null,
  expandedIds: {},
  lastActiveEditorPanelId: null,
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
