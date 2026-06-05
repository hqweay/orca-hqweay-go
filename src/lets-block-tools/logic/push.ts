import { t } from "@/libs/l10n";
import { MoveInfo, PushMode } from "../types";
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

          await orca.commands.invokeEditorCommand(
            "core.editor.batchInsertText",
            null,
            await ensureBlockInState(move.blockId),
            "lastChild",
            blockContent,
          );
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
