import { t } from "@/libs/l10n";
import { DbId } from "../orca";
import { MoveInfo, PushMode } from "./types";
import { Logger } from "@/libs/logger";
import { ensureBlockInState } from "@/libs/utils";

export async function executePush(
  moves: MoveInfo[],
  mode: PushMode,
  logger: Logger,
) {
  let successCount = 0;
  try {
    for (const move of moves) {
      // Ensure target block is loaded into state
      let targetBlock = await ensureBlockInState(move.targetId);

      if (!targetBlock) {
        throw new Error(`Target block ${move.targetId} not found`);
      }

      // 1. Move children to target
      await orca.commands.invokeEditorCommand(
        "core.editor.moveBlocks",
        null,
        move.children,
        move.targetId,
        "lastChild",
      );
      successCount += move.children.length;

      // 2. Handle specific modes
      if (mode === "delete") {
        await orca.commands.invokeEditorCommand(
          "core.editor.deleteBlocks",
          null,
          [move.blockId],
        );
      } else if (mode === "trace") {
        await orca.commands.invokeGroup(async () => {
          // Convert source block to text
          await orca.commands.invokeEditorCommand(
            "core.editor.setBlocksContent",
            null,
            [{ id: move.blockId, content: [{ t: "t", v: move.alias }] }],
            false,
          );

          // Insert references back as children (as a single block containing all references)
          const blockContent = move.children
            .map((childId) => `[[${childId}]]`)
            .join("\n");

          const res = await orca.commands.invokeEditorCommand(
            "core.editor.batchInsertText",
            null,
            await ensureBlockInState(move.blockId),
            "lastChild",
            blockContent,
          );

          // Get block content and insert as children
          // const block = await orca.invokeBackend("get-block", move.blockId);
          // await orca.commands.invokeEditorCommand(
          //   "core.editor.insertBlock",
          //   null,
          //   block,
          //   "lastChild",
          //   fragments,
          //   { type: "text" },
          // );
        });
      }
    }

    const targetCount = new Set(moves.map((m) => m.targetId)).size;
    let msg = "";

    if (targetCount > 1) {
      msg = t("Successfully pushed ${count} blocks to ${targetCount} targets", {
        count: successCount.toString(),
        targetCount: targetCount.toString(),
      });
    } else {
      msg = t("Successfully pushed ${count} blocks", {
        count: successCount.toString(),
      });
    }

    orca.notify("success", msg);
  } catch (e) {
    orca.notify("error", t("Failed to move blocks"));
    logger.error("Failed to push children to ref", e);
  }
}

export async function getBlockText(blockId: any): Promise<string> {
  try {
    const block = orca.state.blocks[blockId] || await orca.invokeBackend("get-block", blockId);
    if (block && block.text) {
      return block.text.trim();
    }
  } catch (e) {
    console.error("Failed to fetch block text for alias", e);
  }
  return "";
}

export function isBlockLink(fragment: any): boolean {
  if (fragment.t !== "l" || typeof fragment.l !== "string") return false;
  const repo = orca.state.repo || "";
  const regex = new RegExp(`^orca-note:\\/\\/${repo}\\/block\\?blockId=(\\d+)$`);
  return regex.test(fragment.l);
}

export function getBlockIdFromLink(url: string): number | null {
  const repo = orca.state.repo || "";
  const regex = new RegExp(`^orca-note:\\/\\/${repo}\\/block\\?blockId=(\\d+)$`);
  const match = url.match(regex);
  if (match) {
    const id = parseInt(match[1], 10);
    return isNaN(id) ? null : id;
  }
  return null;
}

export function makeBlockLink(blockId: any): string {
  const repo = orca.state.repo || "";
  return `orca-note://${repo}/block?blockId=${blockId}`;
}

export function getRefLabelSync(fragment: any, block: any): string {
  const refId = fragment.v;
  const targetRef = block.refs?.find((r: any) => r.id === refId);
  const targetBlockId = targetRef ? targetRef.to : refId;

  let label = fragment.a || targetRef?.alias;
  if (!label && block.text) {
    const match = block.text.match(/^\[(.+?)\]/);
    if (match) label = match[1];
  }
  if (!label) {
    const targetBlock = orca.state.blocks[targetBlockId];
    if (targetBlock && targetBlock.text) {
      label = targetBlock.text.trim();
    }
  }
  return label || "";
}

export async function getRefLabel(fragment: any, block: any): Promise<string> {
  let label = getRefLabelSync(fragment, block);
  if (!label) {
    const refId = fragment.v;
    const targetRef = block.refs?.find((r: any) => r.id === refId);
    const targetBlockId = targetRef ? targetRef.to : refId;
    label = await getBlockText(targetBlockId);
  }
  if (!label) {
    const refId = fragment.v;
    const targetRef = block.refs?.find((r: any) => r.id === refId);
    const targetBlockId = targetRef ? targetRef.to : refId;
    label = `Ref: ${targetBlockId}`;
  }
  return label;
}

export function hasBlockReference(blockIds: number[]): boolean {
  for (const blockId of blockIds) {
    const block = orca.state.blocks[blockId];
    if (block && block.content) {
      if (block.content.some((f) => f.t === "r")) {
        return true;
      }
    }
  }
  return false;
}

export function hasBlockLink(blockIds: number[]): boolean {
  for (const blockId of blockIds) {
    const block = orca.state.blocks[blockId];
    if (block && block.content) {
      if (block.content.some(isBlockLink)) {
        return true;
      }
    }
  }
  return false;
}

export async function executeRefToLink(blockIds: number[]) {
  await orca.commands.invokeGroup(async () => {
    const updates = [];
    for (const blockId of blockIds) {
      const block = orca.state.blocks[blockId];
      if (!block || !block.content) continue;

      let changed = false;
      const newContent = [];
      for (const fragment of block.content) {
        if (fragment.t === "r") {
          const refId = fragment.v;
          const targetRef = block.refs?.find((r: any) => r.id === refId);
          const targetBlockId = targetRef ? targetRef.to : refId;
          const label = await getRefLabel(fragment, block);
          const linkUrl = makeBlockLink(targetBlockId);
          newContent.push({
            t: "l",
            v: label,
            l: linkUrl
          });
          changed = true;
        } else {
          newContent.push(fragment);
        }
      }

      if (changed) {
        updates.push({ id: blockId, content: newContent });
      }
    }

    if (updates.length > 0) {
      await orca.commands.invokeEditorCommand(
        "core.editor.setBlocksContent",
        null,
        updates,
        false
      );
    }
  });
}

export async function executeLinkToRef(blockIds: number[]) {
  await orca.commands.invokeGroup(async () => {
    const updates = [];
    for (const blockId of blockIds) {
      const block = orca.state.blocks[blockId];
      if (!block || !block.content) continue;

      let changed = false;
      const newContent = [];
      for (const fragment of block.content) {
        if (isBlockLink(fragment)) {
          const refBlockId = getBlockIdFromLink(fragment.l);
          if (refBlockId !== null) {
            const refId = await orca.commands.invokeEditorCommand(
              "core.editor.createRef",
              null,
              blockId, // from
              refBlockId, // to
              1, // RefType.Inline
              fragment.v // alias
            );

            if (refId) {
              newContent.push({
                t: "r",
                v: refId,
                a: fragment.v
              });
              changed = true;
            } else {
              newContent.push(fragment);
            }
          } else {
            newContent.push(fragment);
          }
        } else {
          newContent.push(fragment);
        }
      }

      if (changed) {
        updates.push({ id: blockId, content: newContent });
      }
    }

    if (updates.length > 0) {
      await orca.commands.invokeEditorCommand(
        "core.editor.setBlocksContent",
        null,
        updates,
        false
      );
    }
  });
}

export async function executeRefToTextPin(blockIds: number[]) {
  await orca.commands.invokeGroup(async () => {
    const updates = [];
    for (const blockId of blockIds) {
      const block = orca.state.blocks[blockId];
      if (!block || !block.content) continue;

      let changed = false;
      const newContent = [];
      for (const fragment of block.content) {
        if (fragment.t === "r") {
          let baseLabel = await getRefLabel(fragment, block);
          baseLabel = baseLabel.trim();
          if (baseLabel.endsWith("📌")) {
            baseLabel = baseLabel.slice(0, -1).trim();
          }

          if (baseLabel) {
            newContent.push({
              t: "t",
              v: baseLabel
            });
          }
          newContent.push({
            t: "r",
            v: fragment.v,
            a: "📌"
          });
          changed = true;
        } else {
          newContent.push(fragment);
        }
      }

      if (changed) {
        updates.push({ id: blockId, content: newContent });
      }
    }

    if (updates.length > 0) {
      await orca.commands.invokeEditorCommand(
        "core.editor.setBlocksContent",
        null,
        updates,
        false
      );
    }
  });
}

export async function executeRefToPin(blockIds: number[]) {
  await orca.commands.invokeGroup(async () => {
    const updates = [];
    for (const blockId of blockIds) {
      const block = orca.state.blocks[blockId];
      if (!block || !block.content) continue;

      let changed = false;
      const newContent = [];
      for (const fragment of block.content) {
        if (fragment.t === "r") {
          newContent.push({
            ...fragment,
            a: "📌"
          });
          changed = true;
        } else {
          newContent.push(fragment);
        }
      }

      if (changed) {
        updates.push({ id: blockId, content: newContent });
      }
    }

    if (updates.length > 0) {
      await orca.commands.invokeEditorCommand(
        "core.editor.setBlocksContent",
        null,
        updates,
        false
      );
    }
  });
}

