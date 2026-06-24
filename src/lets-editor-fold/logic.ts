import { t } from "@/libs/l10n";

export async function executeEditorExpand(
  targetDepth: number,
  rootBlockId: number,
  logger: any,
) {
  if (!rootBlockId) return;

  try {
    const tree = await orca.invokeBackend("get-block-tree", rootBlockId);
    if (!tree || !Array.isArray(tree)) return;

    // Build parent→children adjacency map from the flat tree
    const childrenMap = new Map<number, number[]>();
    for (const b of tree) {
      const pid = Number(b.parent);
      if (!childrenMap.has(pid)) childrenMap.set(pid, []);
      childrenMap.get(pid)!.push(Number(b.id));
    }

    const blocksToUnfold: number[] = [];
    const blocksToFold: number[] = [];

    // BFS using adjacency map
    const queue: { id: number; depth: number }[] = [
      { id: rootBlockId, depth: 0 },
    ];
    let i = 0;
    while (i < queue.length) {
      const { id, depth } = queue[i++];
      const children = childrenMap.get(id) || [];
      for (const childId of children) {
        const childDepth = depth + 1;
        if (childDepth < targetDepth) {
          blocksToUnfold.push(childId);
          queue.push({ id: childId, depth: childDepth });
        } else if (childDepth === targetDepth) {
          blocksToFold.push(childId);
        }
      }
    }

    logger.info(
      `[EditorFold] level=${targetDepth} unfold=${blocksToUnfold.length} fold=${blocksToFold.length}`,
    );

    // Fold first (hide deeper), then unfold — sequential to avoid editor races
    for (const id of blocksToFold) {
      await orca.commands.invokeEditorCommand(
        "core.editor.foldBlock",
        null,
        id,
      );
    }
    for (const id of blocksToUnfold) {
      await orca.commands.invokeEditorCommand(
        "core.editor.unfoldBlock",
        null,
        id,
      );
    }

    orca.notify("success", t(`Expanded editor to level ${targetDepth}`));
  } catch (e) {
    logger.error("Failed to execute editor expand", e);
    orca.notify("error", t("Failed to expand editor to level"));
  }
}
