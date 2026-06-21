import { proxy } from "valtio";

export interface BlockNavItem {
  id: number;
  text?: string;
  children?: number[];
  selected?: boolean;
  collapsed?: boolean;
}

export interface BlockNavState {
  rootBlockId: number | null;
  items: BlockNavItem[];
  selectedIds: Set<number>;
  lastActiveEditorPanelId: string | null;
}

export const blockNavState = proxy<BlockNavState>({
  rootBlockId: null,
  items: [],
  selectedIds: new Set(),
  lastActiveEditorPanelId: null,
});

export const setRootBlock = (blockId: number | null) => {
  blockNavState.rootBlockId = blockId;
  blockNavState.items = [];
  blockNavState.selectedIds = new Set();
};

export const setItems = (items: BlockNavItem[]) => {
  blockNavState.items = items;
};

export const toggleSelect = (id: number, multi?: boolean) => {
  if (multi) {
    if (blockNavState.selectedIds.has(id)) {
      blockNavState.selectedIds.delete(id);
    } else {
      blockNavState.selectedIds.add(id);
    }
  } else {
    blockNavState.selectedIds.clear();
    blockNavState.selectedIds.add(id);
  }
};

export const selectRange = (id: number) => {
  const items = blockNavState.items;
  const lastSelected = Array.from(blockNavState.selectedIds).pop();
  if (!lastSelected) {
    blockNavState.selectedIds.add(id);
    return;
  }
  const startIdx = items.findIndex((i) => i.id === lastSelected);
  const endIdx = items.findIndex((i) => i.id === id);
  if (startIdx === -1 || endIdx === -1) return;
  const [from, to] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
  for (let i = from; i <= to; i++) {
    blockNavState.selectedIds.add(items[i].id);
  }
};

export const clearSelection = () => {
  blockNavState.selectedIds.clear();
};
