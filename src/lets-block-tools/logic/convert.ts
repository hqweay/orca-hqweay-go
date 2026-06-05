import {
  getRefLabel,
  makeBlockLink,
  isBlockLink,
  getBlockIdFromLink,
} from "./helpers";

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
