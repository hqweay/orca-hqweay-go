
import { BasePlugin } from "@/libs/BasePlugin";
import { setupL10N, t } from "@/libs/l10n";
import { Block, DbId } from "../orca";

export default class SortPlugin extends BasePlugin {
  public async onLoad(): Promise<void> {
    // Register Block Menu Command
    if (orca.blockMenuCommands.registerBlockMenuCommand) {
      orca.blockMenuCommands.registerBlockMenuCommand(
        `${this.name}.sort-blocks`,
        {
          worksOnMultipleBlocks: true,
          render: (blockIds, rootBlockId, close) => {
            // We need to fetch the actual Button or MenuText component
            // But since this is a render function returning a ReactNode, we can use JSX
            const MenuText = orca.components.MenuText;
            if (!MenuText) return null;

            return (
              <MenuText
                title={t("Sort Selected Blocks")}
                onClick={() => {
                  close();
                  orca.commands.invokeCommand(
                    `${this.name}.sort-selection`,
                    blockIds,
                    rootBlockId
                  );
                }}
              />
            );
          },
        }
      );
    }

    // Register Editor Command
    orca.commands.registerCommand(
      `${this.name}.sort-selection`,
      async (blockIds: number[], rootBlockId: number) => {
        if (!blockIds || blockIds.length <= 1) {
          orca.notify("info", t("Select at least 2 blocks to sort."));
          return;
        }

        // 1. Fetch blocks
        // We can access orca.state.blocks directly for cached blocks
        // But to be safe, we might want to ensure we have them.
        // Usually selected blocks are in state.
        const blocks: Block[] = [];
        for (const id of blockIds) {
          let block = orca.state.blocks[id];
          if (!block) {
            block = await orca.invokeBackend("get-block", id);
          }
          if (block) {
            blocks.push(block);
          }
        }

        if (blocks.length !== blockIds.length) {
          orca.notify("error", t("Could not load all selected blocks."));
          return;
        }

        // 2. Identify parent (Assume all share the same parent for now, or we sort within their respective lists?)
        // Multi-select usually implies siblings in Orca?
        // Let's verify they share the same parent.
        const parentId = blocks[0].parent;
        const allSiblings = blocks.every((b) => b.parent === parentId);
        if (!allSiblings || parentId === undefined) {
          orca.notify("warn", t("Blocks must be siblings to sort."));
          return;
        }

        //将 blocks[0] 以json打印
        console.log(JSON.stringify(blocks[0]));

        // 3. Sort Logic
        // Criteria:
        // Group by Type: Task vs Others
        // Within Task: Unchecked vs Checked
        // Within Others: Alphabetical?

        const sortedBlocks = [...blocks].sort((a: any, b: any) => {
          // 1. Get _repr from properties
          const getReprValue = (blk: any) => {
            const prop = blk.properties?.find((p: any) => p.name === "_repr");
            return prop ? prop.value : null;
          };

          const reprA = getReprValue(a);
          const reprB = getReprValue(b);

          // 2. Identify Task: type === 'task'
          const isTask = (r: any) => r?.type === "task";
          const isTaskA = isTask(reprA);
          const isTaskB = isTask(reprB);

          // 3. Compare Types
          if (isTaskA && !isTaskB) return -1; // Task first
          if (!isTaskA && isTaskB) return 1;

          // 4. Compare Tasks
          if (isTaskA && isTaskB) {
            // Check state: 1 is completed (checked), else unchecked
             const stateA = reprA.state === 1;
             const stateB = reprB.state === 1;
             
             if (stateA !== stateB) {
                 // Unchecked (false) before Checked (true)
                 return stateA ? 1 : -1;
             }
             // Same state, proceed to text sort
          }

          // 5. Compare Content (Text)
          // Use 'text' property or first content fragment
          const getText = (blk: any) => {
              if (typeof blk.text === "string") return blk.text;
              return blk.content?.[0]?.v || "";
          }
          const textA = getText(a);
          const textB = getText(b);
          
          if (typeof textA === "string" && typeof textB === "string") {
            return textA.localeCompare(textB);
          }
          return 0;
        });

        // 4. Apply Sort -> Move blocks
        // We have the Desired Order in `sortedBlocks`.
        // We have the Original Order in `blocks`.
        // We probably only need to reorder the subset relative to each other?
        // Or do we move them to a contiguous block?
        // Usually, multi-select is contiguous.

        // We will move them one by one to the correct position.
        // Strategy:
        // Find the block that should be first (sortedBlocks[0]).
        // Move it to 'after' the block *before* the selection?
        // OR: simpler:
        // "Insertion Sort" style moves?
        // We can just iterate through sortedBlocks and move each to be after the previous one.
        // Where to put the *first* block?
        // It should be at the position of the *top-most* block in the original selection.
        // So let's find the "anchor" - the block among the selected ones that was highest in the list.
        // But `blocks` (from arguments) might not be in visual order. `blockIds` might be order of selection.
        // We need to know the visual order to determine where to start inserting.
        // However, we can just pick the first block in the *sorted* list and move it to... wait.

        // If we move block A to after block B, block A is removed from its old spot.

        // To do this robustly:
        // 1. Identify the 'Anchor' block: The block immediately *preceding* the range of sorted blocks.
        //    If the selected blocks are contiguous, the anchor is `blocks[most_top].left`.
        //    But finding 'most_top' requires traversing the list or knowing order.
        //    `block.left` points to previous sibling.
        //    We can find the block whose `block.left` is NOT in the selected set. That block is the first one visually?
        //    Wait, multiple blocks could have `left` not in the set (e.g. if selection is non-contiguous).
        //    BUT, if selection is non-contiguous, sorting and gathering them together is a feature (Group & Sort).

        //    Implementation:
        //    Find the block among selected that is "Check if any block's left is NOT in selected blocks".
        //    Actually, we want to place the *sorted* blocks starting at the position of the *first* block in the original selection (visually).
        //    Let's find the "Reference" block.
        //    If we just want to sort them relative to each other but keep them roughly where they are...
        //    Let's assume we place them starting after the `left` of the *first* block in the original selection?
        //    No, we should find the block that is "top-most".
        //    Since we don't have easy index access, we can rely on one simple heuristic:
        //    Move `sortedBlocks[0]` to `before` `blocks[0]`? No, `blocks[0]` might be anywhere.

        //    Let's assume `blockIds` comes in REVERSE selection order or selection order, not visual order.
        //    Easiest way:
        //    We just move `sortedBlocks[0]` to `after` `sortedBlocks[0].left`? No, `left` changes.

        //    Let's use `invokeBackend("get-block-tree", parentId)`? No, too heavy.

        //    Let's assume we move all sorted blocks strictly to be *after* the block that precedes the *first* selected block.
        //    Actually, finding the "preceding block" is tricky if we don't know the visual order.
        //    We can look at `block.left`.
        //    We collect all `left` IDs of the selected blocks.
        //    Any `left` ID that is NOT in the selected set is a candidate for "Anchor".
        //    If there are multiple (non-contiguous), we pick one?
        //    The user didn't specify behavior for non-contiguous. I'll assume contiguous.
        //    If contiguous, only ONE block has a `left` that is NOT in the selection. That is the first block.
        //    Its `left` is the Anchor.
        //    If it has no `left` (it's the first child), Anchor is null, and we move to `firstChild`.

        let firstBlock = blocks.find((b) => !blockIds.includes(b.left || 0));
        // If all blocks have left in blockIds, it's a loop? Impossible in tree.
        // Note: block.left might be undefined/null for first child?
        // If multiple defined, non-contiguous. We pick the one that seems "first"? We can't tell easily.
        // We'll just pick the first one we found.

        let anchorBlockId = firstBlock?.left;

        // If firstBlock is undefined (weird), or if firstBlock IS the first child (left undefined), anchorBlockId is undefined.

        // Now move sortedBlocks[0] to after anchorBlockId.
        // If anchorBlockId is null/undefined, move to firstChild of parent.

        // Current limitation: I don't know the exact command for "Move".
        // I will attempt `core.editor.moveBlock`.
        // Function signature guess: (cursor, blockId, referenceBlockId, position)
        // position: "after" | "before" | "firstChild" | "lastChild"

        // We will execute sequentially.

        const parentBlock = orca.state.blocks[parentId!];

        let currentAnchor = anchorBlockId;
        let position = currentAnchor ? "after" : "firstChild";
        let reference = currentAnchor
          ? orca.state.blocks[currentAnchor]
          : parentBlock;

        for (let i = 0; i < sortedBlocks.length; i++) {
          const block = sortedBlocks[i];

          // If the block is already in the right place?
          // Checking logic is hard. Just move it.

          // If we are moving to "after" currentAnchor:
          // command: moveBlock(null, block.id, currentAnchor, "after")?
          // Or moveBlock(null, block.id, referenceBlock, position)

          // If position is firstChild, reference is parent.
          // If position is after, reference is anchor.

          try {
            // Determine reference block
            let refBlockId = currentAnchor;
            let pos = "after";

            if (!refBlockId) {
              // Insert as first child of parent
              refBlockId = parentId;
              pos = "firstChild";
            }

            const refBlock = orca.state.blocks[refBlockId!];

            await orca.commands.invokeEditorCommand(
              "core.editor.moveBlocks",
              null,
              [block.id], // Block IDs to move (array)
              refBlockId!, // Reference block ID
              pos, // Position
            );

            // Update anchor to be ANY block we just moved, so next one goes after it.
            currentAnchor = block.id;
          } catch (e) {
            console.warn("Move failed", e);
            // Fallback or ignore
          }
        }

        orca.notify("success", t("Blocks sorted."));
      },
      t("Sort Selection")
    );
     this.logger.info(`${this.name} loaded.`);
  }

    public async onUnload(): Promise<void> {
        orca.blockMenuCommands.unregisterBlockMenuCommand(`${this.name}.sort-blocks`);
        orca.commands.unregisterCommand(`${this.name}.sort-selection`);
        this.logger.info(`${this.name} unloaded.`);
    }
}
