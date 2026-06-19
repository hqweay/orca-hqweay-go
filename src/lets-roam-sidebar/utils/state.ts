import { proxy } from "valtio";

export interface StackedBlock {
  id: number;
}

export const roamSidebarState = proxy({
  stackedBlocks: [] as StackedBlock[],
});

export const addStackedBlock = (blockId: number) => {
  const existingIdx = roamSidebarState.stackedBlocks.findIndex(b => b.id === blockId);
  if (existingIdx >= 0) {
    roamSidebarState.stackedBlocks.splice(existingIdx, 1);
  }
  roamSidebarState.stackedBlocks.unshift({ id: blockId });
};

export const removeStackedBlock = (blockId: number) => {
  const existingIdx = roamSidebarState.stackedBlocks.findIndex(b => b.id === blockId);
  if (existingIdx >= 0) {
    roamSidebarState.stackedBlocks.splice(existingIdx, 1);
  }
};
