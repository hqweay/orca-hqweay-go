import { BlockNavItem } from "./state";
import { Block } from "../../orca";

export const getCurrentBlockId = (): number | null => {
  const activePanelId = orca.state.activePanel;
  if (!activePanelId) return null;

  const viewPanel = orca.nav.findViewPanel(activePanelId, orca.state.panels);
  if (!viewPanel?.viewArgs) return null;

  return viewPanel.viewArgs.blockId || null;
};

export const getChildBlocks = async (blockId: number): Promise<Block[]> => {
  let block = orca.state.blocks[blockId];
  if (!block) {
    block = await orca.invokeBackend("get-block", blockId);
  }
  if (!block?.children?.length) return [];

  const childrenIds = Array.from(block.children);
  const childBlocks = await orca.invokeBackend("get-blocks", childrenIds);
  const blocks = (childBlocks || []) as Block[];

  const blockMap = new Map<number, Block>();
  for (const b of blocks) {
    blockMap.set(b.id, b);
  }

  return childrenIds
    .map((id) => blockMap.get(id))
    .filter((b): b is Block => b !== undefined);
};

import { getBlockTitle as getBlockTitleUtil, getBlockIcon, getBlockColor } from "../../libs/utils";

export const buildNavItems = (blocks: Block[]): BlockNavItem[] => {
  return blocks.map((b) => ({
    id: Number(b.id),
    text: getBlockTitleUtil(b, b.id),
    icon: getBlockIcon(b),
    color: getBlockColor(b),
    children: b.children || [],
    selected: false,
    collapsed: false,
  }));
};

export const moveBlockToParent = async (
  blockId: number,
  newParentId: number,
  position?: number
): Promise<void> => {
  await orca.commands.invokeEditorCommand(
    "core.editor.moveBlocks",
    null,
    [blockId],
    newParentId,
    position ?? "lastChild"
  );
};

export const getBlockTitle = (blockId: number): string => {
  const block = orca.state.blocks[blockId];
  return getBlockTitleUtil(block, blockId);
};
