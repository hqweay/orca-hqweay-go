import { proxy } from "valtio";

export interface StackedBlock {
  id: number;
  collapsed: boolean;
}

export const roamSidebarState = proxy({
  stackedBlocks: [] as StackedBlock[],
});

export const addStackedBlock = (blockId: number) => {
  const existingIdx = roamSidebarState.stackedBlocks.findIndex(b => b.id === blockId);
  if (existingIdx >= 0) {
    roamSidebarState.stackedBlocks.splice(existingIdx, 1);
  }
  roamSidebarState.stackedBlocks.unshift({ id: blockId, collapsed: false });
};

export const removeStackedBlock = (blockId: number) => {
  const existingIdx = roamSidebarState.stackedBlocks.findIndex(b => b.id === blockId);
  if (existingIdx >= 0) {
    roamSidebarState.stackedBlocks.splice(existingIdx, 1);
  }
};

export const toggleBlockCollapse = (blockId: number) => {
  const block = roamSidebarState.stackedBlocks.find(b => b.id === blockId);
  if (block) {
    block.collapsed = !block.collapsed;
  }
};
