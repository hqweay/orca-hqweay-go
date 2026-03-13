import { formatUtil } from "@/libs/format";
import { setupL10N, t } from "@/libs/l10n";
import { BasePlugin } from "@/libs/BasePlugin";
import React from "react";

export default class FormatPlugin extends BasePlugin {
  protected headbarButtonId = `${this.name}.format-block`;

  public async load(): Promise<void> {
    orca.commands.registerCommand(
      `${this.name}.format-block`,
      async () => {
        // 1. Get active panel info
        const panel = orca.state.activePanel;
        if (!panel) return;

        this.logger.debug("Active panel:", panel);
        const viewPanel = orca.nav.findViewPanel(panel, orca.state.panels);
        if (!viewPanel) return;

        this.logger.debug("View panel:", viewPanel);
        const { viewArgs } = viewPanel;
        if (!viewArgs) return;

        this.logger.debug("View args:", viewArgs);
        let rootBlockId: number | null = null;

        // 2. Determine root block ID
        if (viewArgs.date) {
          // It's a journal page
          const journalBlock = await orca.invokeBackend(
            "get-journal-block",
            viewArgs.date,
          );
          if (journalBlock) {
            rootBlockId = journalBlock.id;
          }
        } else if (viewArgs.blockId) {
          // It's a regular block page
          rootBlockId = viewArgs.blockId;
        }

        this.logger.debug("Root block ID:", rootBlockId);
        if (rootBlockId === null) return;

        // 3. Fetch block tree
        // User requested "top 2 levels". get-block-tree returns the whole tree.
        // We will traverse and filter manually for depth <= 2.
        const blockTree = await orca.invokeBackend(
          "get-block-tree",
          rootBlockId,
        );

        this.logger.debug("Block tree:", blockTree);
        if (!blockTree) return;

        const updates: { id: number; content: any[] }[] = [];

        // Helper to process a block
        const processBlock = (block: any) => {
          // 只格式化纯文本块，不格式化代码块
          if (
            block.content &&
            (block.properties?.every(
              (p: any) =>
                p.value?.type !== "code" || p.value?.lang === "Markdown",
            ) ??
              true)
          ) {
            let hasChanged = false;
            const newContent = block.content.map((fragment: any) => {
              if (fragment.t === "t" && typeof fragment.v === "string") {
                const formattedText = formatUtil.formatContent(fragment.v);
                if (formattedText !== fragment.v) {
                  hasChanged = true;
                  return { ...fragment, v: formattedText };
                }
              }
              return fragment;
            });
            if (hasChanged) {
              updates.push({
                id: block.id,
                content: newContent,
              });
            }
          }
        };

        // 4. Traverse tree (Root + Children + Grandchildren)
        // Level 0: Root
        const rootBlock = orca.state.blocks[rootBlockId];
        this.logger.debug("Root block:", rootBlock);
        processBlock(rootBlock);

        // if (rootBlock.childrenBlocks) {
        for (const child of blockTree) {
          // Level 1: Immediate children
          processBlock(child);

          // if (child.childrenBlocks) {
          //   for (const grandChild of child.childrenBlocks) {
          //     // Level 2: Grandchildren
          //     processBlock(grandChild);
          //   }
          // }
        }
        // }

        // 5. Apply updates
        if (updates.length > 0) {
          await orca.commands.invokeEditorCommand(
            "core.editor.setBlocksContent",
            null, // cursor data not strictly needed for batch content update if we don't care about restoring cursor exactly here
            updates,
            false, // setBackCursor
          );

          // Notify user
          orca.broadcasts.broadcast("core.notify", {
            type: "success",
            message: `Formatted ${updates.length} blocks.`,
          });
        } else {
          orca.broadcasts.broadcast("core.notify", {
            type: "info",
            message: "No blocks needed formatting.",
          });
        }

        orca.notify("info", t(`Formatted ${updates.length} blocks.`));
      },
      t("Format Block"),
    );

    this.logger.info(`${this.name} loaded.`);
  }

  public async unload(): Promise<void> {
    orca.commands.unregisterCommand(`${this.name}.format-block`);
    this.logger.info(`${this.name} unloaded.`);
  }

  protected renderHeadbarMenuItems(closeMenu: () => void): React.ReactNode[] {
    const MenuText = orca.components.MenuText;
    return [
      React.createElement(MenuText, {
        key: "format-block",
        preIcon: "ti ti-refresh",
        title: t("Format Block"),
        onClick: async () => {
          closeMenu();
          await orca.commands.invokeCommand(`${this.name}.format-block`);
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
      <Tooltip text={t("Format Block")}>
        <Button
          variant="plain"
          onClick={async () =>
            orca.commands.invokeCommand(`${this.name}.format-block`)
          }
        >
          <i className="ti ti-refresh" />
        </Button>
      </Tooltip>
    );
  }
}
