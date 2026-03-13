import { BasePlugin } from "@/libs/BasePlugin";
import { t } from "@/libs/l10n";
import { Block, DbId } from "../orca";
import { getBlocks, getRepr } from "@/libs/utils";
import React from "react";

interface BlockWithLevel {
  block: Block;
  level: number; // 0 = text, 1-4 = H1-H4
}

export default class HeadingTreePlugin extends BasePlugin {
  protected headbarButtonId = `${this.name}.heading-tree`;

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

            // todo 可以调整为一个块时对其子块处理。先这样吧

            // Only show when 2+ blocks are selected
            if (!blockIds || blockIds.length <= 1) return null;

            return (
              <MenuText
                preIcon="ti ti-list-tree"
                title={t("Reorganize Headings")}
                onClick={async () => {
                  close();
                  const blocks = await getBlocks(blockIds);
                  await this.executeReorganize(blocks);
                }}
              />
            );
          },
        },
      );
    }

    // Register selection reorganization command
    orca.commands.registerCommand(
      `${this.name}.reorganize-selection`,
      async (blockIds: number[]) => this.executeReorganizeSelection(blockIds),
      t("Reorganize Headings"),
    );

    // Register active panel reorganization command
    orca.commands.registerCommand(
      `${this.name}.reorganize-active-panel`,
      async () => this.executeReorganizeActivePanel(),
      t("Reorganize Current Page"),
    );

    this.logger.info(`${this.name} loaded.`);
  }

  private async executeReorganizeSelection(blockIds: number[]) {
    if (!blockIds || blockIds.length <= 1) {
      orca.notify("info", t("Select at least 2 blocks to reorganize."));
      return;
    }

    const blocks = await getBlocks(blockIds);
    if (blocks.length !== blockIds.length) {
      orca.notify("error", t("Could not load all selected blocks."));
      return;
    }

    // Check all blocks are siblings
    const parentId = blocks[0].parent;
    const allSiblings = blocks.every((b) => b.parent === parentId);
    if (!allSiblings || parentId === undefined) {
      orca.notify("warn", t("Blocks must be siblings to reorganize."));
      return;
    }

    await this.executeReorganize(blocks);
  }

  private async executeReorganizeActivePanel() {
    const panel = orca.state.activePanel;
    if (!panel) return;

    const viewPanel = orca.nav.findViewPanel(panel, orca.state.panels);
    if (!viewPanel?.viewArgs) return;

    let rootBlockId: number | null = null;
    const { viewArgs } = viewPanel;

    if (viewArgs.date) {
      const journalBlock = await orca.invokeBackend(
        "get-journal-block",
        viewArgs.date,
      );
      if (journalBlock) rootBlockId = journalBlock.id;
    } else if (viewArgs.blockId) {
      rootBlockId = viewArgs.blockId;
    }

    if (rootBlockId === null) return;

    const rootBlock =
      orca.state.blocks[rootBlockId] ||
      (await orca.invokeBackend("get-block", rootBlockId));
    if (!rootBlock || !rootBlock.children) return;

    // Use children order from root block
    const topLevelBlocks = await getBlocks(rootBlock.children);
    if (topLevelBlocks.length <= 1) {
      orca.notify("info", t("Not enough blocks to reorganize."));
      return;
    }

    await this.executeReorganize(topLevelBlocks);
  }

  public async unload(): Promise<void> {
    orca.blockMenuCommands.unregisterBlockMenuCommand(
      `${this.name}.reorganize-headings`,
    );
    orca.commands.unregisterCommand(`${this.name}.reorganize-selection`);
    orca.commands.unregisterCommand(`${this.name}.reorganize-active-panel`);
    this.logger.info(`${this.name} unloaded.`);
  }

  protected renderHeadbarMenuItems(closeMenu: () => void): React.ReactNode[] {
    const MenuText = orca.components.MenuText;
    return [
      React.createElement(MenuText, {
        key: "reorganize-active-panel",
        preIcon: "ti ti-list-tree",
        title: t("Reorganize Current Page"),
        onClick: async () => {
          closeMenu();
          await orca.commands.invokeCommand(
            `${this.name}.reorganize-active-panel`,
          );
        },
      }),
      React.createElement(orca.components.MenuSeparator, {
        key: "sep-settings",
      }),
    ];
  }

  public renderHeadbarButton(): React.ReactNode {
    const Button = orca.components.Button;
    const Tooltip = orca.components.Tooltip;
    return (
      <Tooltip text={t("Reorganize Current Page")}>
        <Button
          variant="plain"
          onClick={() =>
            orca.commands.invokeCommand(`${this.name}.reorganize-active-panel`)
          }
        >
          <i className="ti ti-list-tree" />
        </Button>
      </Tooltip>
    );
  }

  private async executeReorganize(blocks: Block[]) {
    // 3. Analyze heading levels
    const blocksWithLevels: BlockWithLevel[] = blocks.map((block) => ({
      block,
      level: this.getHeadingLevel(block),
    }));

    const hasHeading = blocksWithLevels.some((b) => b.level > 0);
    if (!hasHeading) {
      orca.notify("warn", t("No heading blocks found in selection."));
      return;
    }

    await this.reorganizeByHeading(blocksWithLevels);
    orca.notify("success", t("Headings reorganized."));
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
    const moves: {
      blockId: DbId;
      targetId: DbId;
      position: "after" | "lastChild";
    }[] = [];

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
        const targetBlock = blocksWithLevels.find(
          (b) => b.block.id === targetBlockId,
        )?.block;

        if (targetBlock && currentBlock.parent !== targetBlock.parent) {
          moves.push({
            blockId: block.id,
            targetId: targetBlockId,
            position: "after",
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
            position: "lastChild",
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
