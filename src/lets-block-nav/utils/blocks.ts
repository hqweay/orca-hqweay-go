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
  return (childBlocks || []) as Block[];
};

export const buildNavItems = (blocks: Block[]): BlockNavItem[] => {
  return blocks.map((b) => ({
    id: Number(b.id),
    text: b.text || `Block ${b.id}`,
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

export const deleteBlocks = async (blockIds: number[]): Promise<void> => {
  for (const id of blockIds) {
    await orca.commands.invokeEditorCommand(
      "core.editor.deleteBlock",
      null,
      id
    );
  }
};

export const getBlockTitle = (blockId: number): string => {
  const block = orca.state.blocks[blockId];
  if (!block) return `Block ${blockId}`;
  return block.text || `Block ${blockId}`;
};
