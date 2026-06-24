import { t } from "@/libs/l10n";

async function batchInvoke(
  command: string,
  ids: number[],
  chunkSize = 20,
) {
  for (let i = 0; i < ids.length; i += chunkSize) {
    await Promise.all(
      ids.slice(i, i + chunkSize).map((id) =>
        orca.commands.invokeEditorCommand(command, null, id),
      ),
    );
  }
}

export async function executeEditorExpand(
  targetDepth: number | "all",
  rootBlockId: number,
  logger?: any,
) {
  if (!rootBlockId) return;

  try {
    const tree = await orca.invokeBackend("get-block-tree", rootBlockId);
    if (!tree || !Array.isArray(tree)) return;

    const childrenMap = new Map<number, number[]>();
    for (const b of tree) {
      const pid = Number(b.parent);
      if (!childrenMap.has(pid)) childrenMap.set(pid, []);
      childrenMap.get(pid)!.push(Number(b.id));
    }

    const blocksToUnfold: number[] = [];
    const blocksToFold: number[] = [];

    const maxDepth = targetDepth === "all" ? Number.MAX_SAFE_INTEGER : targetDepth;

    const queue: { id: number; depth: number }[] = [
      { id: rootBlockId, depth: 0 },
    ];
    let i = 0;
    while (i < queue.length) {
      const { id, depth } = queue[i++];
      const children = childrenMap.get(id) || [];
      for (const childId of children) {
        const childDepth = depth + 1;
        if (childDepth < maxDepth) {
          blocksToUnfold.push(childId);
          queue.push({ id: childId, depth: childDepth });
        } else if (childDepth === maxDepth) {
          blocksToFold.push(childId);
        }
      }
    }

    logger?.info(
      `[EditorFold] level=${targetDepth} unfold=${blocksToUnfold.length} fold=${blocksToFold.length}`,
    );

    await batchInvoke("core.editor.foldBlock", blocksToFold);
    await batchInvoke("core.editor.unfoldBlock", blocksToUnfold);

    orca.notify("success", t(`Expanded editor to level ${targetDepth}`));
  } catch (e) {
    logger?.error("Failed to execute editor expand", e);
    orca.notify("error", t("Failed to expand editor to level"));
  }
}
