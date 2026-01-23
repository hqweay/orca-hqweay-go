import { BasePlugin } from "@/libs/BasePlugin";
import { setupL10N, t } from "@/libs/l10n";
import { Block, DbId } from "../orca";
import { getRepr } from "@/libs/utils";
import { SettingsItem, SettingsSection } from "@/components/SettingsItem";
import React, { useState } from "react";

export default class SortPlugin extends BasePlugin {
  protected settingsComponent = SortSettings;

  public async load(): Promise<void> {
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

            if (!blockIds || blockIds.length <= 1) return null;

            return (
              <MenuText
                preIcon="ti ti-sort-ascending-letters"
                title={t("Sort Selected Blocks")}
                onClick={() => {
                  close();
                  orca.commands.invokeCommand(
                    `${this.name}.sort-selection`,
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

    // Register Editor Command
    orca.commands.registerCommand(
      `${this.name}.sort-selection`,
      async (blockIds: number[], rootBlockId: number) => {
        // ... (validation and fetching blocks) ...
        if (!blockIds || blockIds.length <= 1) {
          orca.notify("info", t("Select at least 2 blocks to sort."));
          return;
        }

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

        const parentId = blocks[0].parent;
        const allSiblings = blocks.every((b) => b.parent === parentId);
        if (!allSiblings || parentId === undefined) {
          orca.notify("warn", t("Blocks must be siblings to sort."));
          return;
        }

        // Get sort order from settings
        const settings = this.getSettings();
        const sortOrderStr =
          settings.order || "empty, other, task_checked, task_unchecked";
        const sortOrder = sortOrderStr
          .split(/[,，]/)
          .map((s: string) => s.trim());

        const sortedBlocks = [...blocks].sort((a: any, b: any) => {
          const getType = (blk: any): string => {
            // 1. Get _repr to check for Task
            const repr = getRepr(blk);

            if (repr?.type === "task") {
              const isChecked = repr.state === 1;
              return isChecked ? "task_checked" : "task_unchecked";
            }

            // 2. Check for Empty
            const text =
              typeof blk.text === "string"
                ? blk.text
                : blk.content?.[0]?.v || "";
            if (!text || text.trim() === "") {
              return "empty";
            }

            return "other";
          };

          const typeA = getType(a);
          const typeB = getType(b);

          const idxA = sortOrder.indexOf(typeA);
          const idxB = sortOrder.indexOf(typeB);

          // Use Infinity for unknown types to push them to end (or keep relative?)
          const valA = idxA === -1 ? 999 : idxA;
          const valB = idxB === -1 ? 999 : idxB;

          if (valA !== valB) {
            return valA - valB;
          }

          // Same type, tie-break with alphabetical text
          const getText = (blk: any) => {
            if (typeof blk.text === "string") return blk.text;
            return blk.content?.[0]?.v || "";
          };
          const textA = getText(a);
          const textB = getText(b);

          if (typeof textA === "string" && typeof textB === "string") {
            return textA.localeCompare(textB);
          }
          return 0;
        });

        // ... (movement logic) ...
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
      t("Sort Selection"),
    );
    this.logger.info(`${this.name} loaded.`);
  }

  public async unload(): Promise<void> {
    orca.blockMenuCommands.unregisterBlockMenuCommand(
      `${this.name}.sort-blocks`,
    );
    orca.commands.unregisterCommand(`${this.name}.sort-selection`);
    this.logger.info(`${this.name} unloaded.`);
  }
}

function SortSettings({ plugin }: { plugin: SortPlugin }) {
  const settings = plugin["getSettings"]();
  const [order, setOrder] = useState(
    settings.order || "empty, other, task_checked, task_unchecked",
  );

  const updateOrder = async (value: string) => {
    setOrder(value);
    await plugin["updateSettings"]({ order: value });
  };

  const TextArea = orca.components.CompositionTextArea;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <SettingsSection title={t("Sort Settings")}>
        <SettingsItem
          label={t("Sort Order")}
          vertical
          description={t(
            "Separate types with commas. Types: 'empty', 'other', 'task_checked', 'task_unchecked'.",
          )}
        >
          <TextArea
            // @ts-ignore
            value={order}
            onChange={(e: any) => updateOrder(e.target.value)}
            style={{ width: "100%", minHeight: "80px" }}
          />
        </SettingsItem>
      </SettingsSection>
    </div>
  );
}
