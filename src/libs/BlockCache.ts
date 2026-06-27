import { Block } from "../orca";

export function isValidId(id: any): id is number {
  return typeof id === "number" && !isNaN(id);
}

/**
 * Fetch blocks by IDs using memory-first strategy.
 * Checks orca.state.blocks first, then falls back to backend "get-blocks".
 */
export async function getBlocks(blockIds: number[]): Promise<Block[]> {
  const notInMemoryBlockIds = [];
  const result: Block[] = [];

  for (const blockId of blockIds) {
    const block = orca.state.blocks[blockId];
    if (block) {
      result.push(block);
    } else {
      notInMemoryBlockIds.push(blockId);
    }
  }

  if (notInMemoryBlockIds.length > 0) {
    const fetchedBlocks = await orca.invokeBackend("get-blocks", notInMemoryBlockIds);
    if (fetchedBlocks && Array.isArray(fetchedBlocks)) {
      for (const b of fetchedBlocks) {
        orca.state.blocks[b.id] = b;
        result.push(b);
      }
    }
  }

  return result;
}

/**
 * Ensures the specified block is loaded and cached in orca.state.blocks.
 * This is crucial before calling editor commands (like moveBlocks) on blocks
 * that might not be currently open in the active editor.
 */
export async function ensureBlockInState(blockId: number): Promise<Block | null> {
  if (!isValidId(blockId)) {
    return null;
  }
  let block = orca.state.blocks[blockId];
  if (!block) {
    block = await orca.invokeBackend("get-block", blockId);
    if (block) {
      orca.state.blocks[blockId] = block;
    }
  }
  return block || null;
}

export const getChildBlocks = async (blockId: number): Promise<Block[]> => {
  let block = await ensureBlockInState(blockId);
  if (!block?.children?.length) return [];

  const childrenIds = Array.from(block.children);
  const blocks = await getBlocks(childrenIds as number[]);

  const blockMap = new Map<number, Block>();
  for (const b of blocks) {
    blockMap.set(Number(b.id), b as Block);
  }

  return childrenIds
    .map((id) => blockMap.get(Number(id)))
    .filter((b): b is Block => b !== undefined);
};

export const moveBlockToParent = async (
  blockId: number,
  newParentId: number,
  position?: number | string
): Promise<void> => {
  await orca.commands.invokeEditorCommand(
    "core.editor.moveBlocks",
    null,
    [blockId],
    newParentId,
    position ?? "lastChild"
  );
};
