import { Block } from "../orca";

import { PropType } from "./consts";

export async function ensureInbox(
  container: Block,
  inboxName: string,
): Promise<Block> {
  const notInMemoryBlockIds = [];

  for (const blockId of container.children) {
    const block = orca.state.blocks[blockId];
    if (block != null) {
      if (block.text?.trim() === inboxName) {
        return block;
      }
    } else {
      notInMemoryBlockIds.push(blockId);
    }
  }

  const blocks: Block[] = await orca.invokeBackend(
    "get-blocks",
    notInMemoryBlockIds,
  );
  const inbox = blocks.find((block) => block.text?.trim() === inboxName);

  if (inbox == null) {
    const inboxBlockId = await orca.commands.invokeEditorCommand(
      "core.editor.insertBlock",
      null,
      container,
      "lastChild",
      [{ t: "t", v: inboxName }],
    );
    return orca.state.blocks[inboxBlockId]!;
  }

  return inbox!;
}

export function getRepr(block: Block): any {
  // Return type: Repr
  // Default
  let repr: any = { type: "text" };

  if (block.properties) {
    const reprProp = block.properties.find((p) => p.name === "_repr");
    if (reprProp && reprProp.value) {
      repr = reprProp.value;
    }
  }
  return repr;
}

/**
 * Fetch blocks by IDs using memory-first strategy.
 * Checks orca.state.blocks first, then falls back to backend "get-block".
 */
export async function getBlocks(blockIds: number[]): Promise<Block[]> {
  return await orca.invokeBackend("get-blocks", blockIds);
}

export function isValidId(id: any): id is number {
  return typeof id === "number" && !isNaN(id);
}

/**
 * Ensures the specified block is loaded and cached in orca.state.blocks.
 * This is crucial before calling editor commands (like moveBlocks) on blocks
 * that might not be currently open in the active editor.
 */
export async function ensureBlockInState(
  blockId: number,
): Promise<Block | null> {
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

export const getBlockTitle = (block: any, fallbackId: string | number): string => {
  if (!block) return `Block ${String(fallbackId).substring(0, 8)}`;

  const displayName = block.properties?.find((p: any) => p.name === "displayName")?.value;
  if (displayName) return String(displayName);

  const reprProp = block.properties?.find((p: any) => p.name === "_repr");
  if (reprProp && reprProp.value?.type === "journal" && reprProp.value?.date) {
    const d = new Date(reprProp.value.date);
    if (!isNaN(d.getTime())) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }
  }

  if (block.aliases && block.aliases.length > 0) return String(block.aliases[0]);
  if (block.text && block.text.trim().length > 0) {
    let text = block.text.trim();
    if (text.length > 20) {
      return text.substring(0, 20) + "...";
    }
    return text;
  }
  return `Block ${String(fallbackId).substring(0, 8)}`;
};

export const getBlockIcon = (block: any) => {
  if (!block) return "📄";

  const iconProp = block.properties?.find((p: any) => p.name === "_icon");
  if (iconProp && iconProp.value) {
    return String(iconProp.value);
  }

  const reprProp = block.properties?.find((p: any) => p.name === "_repr");
  if (reprProp && reprProp.value?.type === "journal" && reprProp.value?.date) {
    return `__journal__:${reprProp.value.date}`;
  }

  return "📄";
};

export const getBlockColor = (block: any): string | undefined => {
  if (!block) return undefined;
  const colorProp = block.properties?.find((p: any) => p.name === "_color");
  if (colorProp && colorProp.value) {
    return String(colorProp.value);
  }
  return undefined;
};
