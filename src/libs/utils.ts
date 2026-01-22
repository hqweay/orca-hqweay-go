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
    if (reprProp && reprProp.type === PropType.JSON && reprProp.value) {
      repr = reprProp.value;
    }
  }
  return repr;
}
