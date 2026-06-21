import { proxy } from "valtio";

export interface BlockNavItem {
  id: number;
  text?: string;
  icon?: string;
  color?: string;
  children?: number[];
  selected?: boolean;
  collapsed?: boolean;
}

export interface BlockNavState {
  rootBlockId: number | null;
  items: BlockNavItem[];
  lastActiveEditorPanelId: string | null;
}

export const blockNavState = proxy<BlockNavState>({
  rootBlockId: null,
  items: [],
  lastActiveEditorPanelId: null,
});

export const setRootBlock = (blockId: number | null) => {
  blockNavState.rootBlockId = blockId;
  blockNavState.items = [];
};

export const setItems = (items: BlockNavItem[]) => {
  blockNavState.items = items;
};
