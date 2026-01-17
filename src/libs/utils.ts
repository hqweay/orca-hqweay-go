import { Block } from "../orca";

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
