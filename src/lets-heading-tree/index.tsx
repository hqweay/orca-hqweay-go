import { BasePlugin } from "@/libs/BasePlugin";
import { t } from "@/libs/l10n";
import { Block, DbId } from "../orca";
import { getRepr } from "@/libs/utils";
import React from "react";

interface BlockWithLevel {
  block: Block;
  level: number; // 0 = text, 1-4 = H1-H4
}

export default class HeadingTreePlugin extends BasePlugin {
  public async load(): Promise<void> {
    // Register Block Menu Command
    if (orca.blockMenuCommands.registerBlockMenuCommand) {
      orca.blockMenuCommands.registerBlockMenuCommand(
        `${this.name}.reorganize-headings`,
        {
          worksOnMultipleBlocks: true,
          render: (blockIds, rootBlockId, close) => {
            const MenuText = orca.components.MenuText;
            if (!MenuText) return null;

            // Only show when 2+ blocks are selected
            if (!blockIds || blockIds.length <= 1) return null;

            return (
              <MenuText
                preIcon="ti ti-list-tree"
                title={t("Reorganize Headings")}
                onClick={() => {
                  close();
                  orca.commands.invokeCommand(
                    `${this.name}.reorganize-selection`,
                    blockIds,
                    rootBlockId,
                  );
                }}
              />
            );
          },
        },
      );
    }

    // Register the command
    orca.commands.registerCommand(
      `${this.name}.reorganize-selection`,
      async (blockIds: number[], rootBlockId: number) => {
        if (!blockIds || blockIds.length <= 1) {
          orca.notify("info", t("Select at least 2 blocks to reorganize."));
          return;
        }

        // 1. Fetch all blocks
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

        // 2. Check all blocks are siblings
        const parentId = blocks[0].parent;
        const allSiblings = blocks.every((b) => b.parent === parentId);
        if (!allSiblings || parentId === undefined) {
          orca.notify("warn", t("Blocks must be siblings to reorganize."));
          return;
        }

        // 3. Analyze heading levels
        const blocksWithLevels: BlockWithLevel[] = blocks.map((block) => ({
          block,
          level: this.getHeadingLevel(block),
        }));

        // 4. Check if there's at least one heading block
        const hasHeading = blocksWithLevels.some((b) => b.level > 0);
        if (!hasHeading) {
          orca.notify("warn", t("No heading blocks found in selection."));
          return;
        }

        // 5. Build tree structure and move blocks
        await this.reorganizeByHeading(blocksWithLevels);

        orca.notify("success", t("Headings reorganized."));
      },
      t("Reorganize Headings"),
    );

    this.logger.info(`${this.name} loaded.`);
  }

  public async unload(): Promise<void> {
    orca.blockMenuCommands.unregisterBlockMenuCommand(
      `${this.name}.reorganize-headings`,
    );
    orca.commands.unregisterCommand(`${this.name}.reorganize-selection`);
    this.logger.info(`${this.name} unloaded.`);
  }

  /**
   * Get heading level from block's _repr
   * Returns: 1-4 for H1-H4, 0 for non-heading (text)
   */
  private getHeadingLevel(block: Block): number {
    const repr = getRepr(block);
    if (repr.type === "heading" && typeof repr.level === "number") {
      return repr.level; // 1, 2, 3, 4
    }
    return 0; // Not a heading = level 0 (will be child of any heading)
  }

  /**
   * Reorganize blocks by heading hierarchy
   * Algorithm:
   * - Use a stack to track the current hierarchy path
   * - For each block, find its proper parent based on heading levels
   * - Only move blocks when necessary to establish correct parent-child relationships
   */
  private async reorganizeByHeading(
    blocksWithLevels: BlockWithLevel[],
  ): Promise<void> {
    if (blocksWithLevels.length === 0) return;

    // Stack maintains the "path" to current position in the tree
    // Each entry: { blockId, level }
    const stack: { blockId: DbId; level: number }[] = [];

    // Track where each block should be placed
    const moves: { blockId: DbId; targetId: DbId; position: 'after' | 'lastChild' }[] = [];

    // Process blocks in order
    for (let i = 0; i < blocksWithLevels.length; i++) {
      const { block, level } = blocksWithLevels[i];

      if (i === 0) {
        // First block stays in place as the root
        stack.push({ blockId: block.id, level });
        continue;
      }

      // Find the correct parent by popping the stack
      // Pop until we find a block with a smaller level number (higher in hierarchy)
      while (stack.length > 0) {
        const top = stack[stack.length - 1];

        if (level === 0) {
          // Text block: child of any heading
          break;
        }

        if (top.level === 0) {
          // Top is text, can't be parent of heading
          stack.pop();
          continue;
        }

        if (level > top.level) {
          // Current block is a sub-heading of top (e.g., H2 under H1)
          // This is the correct parent
          break;
        }

        // Current is same level or higher level heading
        // Pop and continue searching
        stack.pop();
      }

      // Determine target position
      if (stack.length === 0) {
        // No valid parent found
        // This block should be a sibling of the first block
        // Find the last block at the same level as the first block
        let targetBlockId = blocksWithLevels[0].block.id;
        
        for (let j = 1; j < i; j++) {
          if (blocksWithLevels[j].level === blocksWithLevels[0].level) {
            targetBlockId = blocksWithLevels[j].block.id;
          }
        }

        // Only add move if this block is not already after the target
        const currentBlock = block;
        const targetBlock = blocksWithLevels.find(b => b.block.id === targetBlockId)?.block;
        
        if (targetBlock && currentBlock.parent !== targetBlock.parent) {
          moves.push({
            blockId: block.id,
            targetId: targetBlockId,
            position: 'after',
          });
        }
      } else {
        // Should be child of the top of stack
        const parentId = stack[stack.length - 1].blockId;
        
        // Only move if the block is not already a child of the correct parent
        if (block.parent !== parentId) {
          moves.push({
            blockId: block.id,
            targetId: parentId,
            position: 'lastChild',
          });
        }
      }

      // Push current block to stack if it's a heading
      if (level > 0) {
        stack.push({ blockId: block.id, level });
      }
    }

    // Execute moves
    for (const move of moves) {
      await orca.commands.invokeEditorCommand(
        "core.editor.moveBlocks",
        null,
        [move.blockId],
        move.targetId,
        move.position,
      );
    }
  }
}
