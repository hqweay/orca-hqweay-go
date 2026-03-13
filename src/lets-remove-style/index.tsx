import { setupL10N, t } from "@/libs/l10n";
import { BasePlugin } from "@/libs/BasePlugin";
import React from "react";
import { getRepr } from "@/libs/utils";

export default class FormatPlugin extends BasePlugin {
  protected headbarButtonId = `${this.name}.remove-style`;

  public async load(): Promise<void> {
    orca.commands.registerCommand(
      `${this.name}.remove-style`,
      async (removeTypes: string[] = ["inline", "link"]) => {
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
        const blocksToDelete: number[] = [];

        const processBlock = (block: any) => {
          // Helper to process a block
          // type ContentFragment = {
          //   t: string;
          //   v: any;
          //   f?: string;
          //   fa?: Record<string, any>;
          //   [key: string]: any;
          // };

          // Handling "remove empty lines"
          if (removeTypes.includes("emptyLine")) {
            const isContentEmpty =
              !block.content ||
              block.content.length === 0 ||
              (block.content.length === 1 &&
                block.content[0].t === "t" &&
                // 如果是空格行，也删掉
                block.content[0].v.trim() === "");
            const isChildrenEmpty =
              !block.children || block.children.length === 0;

            if (
              isContentEmpty &&
              isChildrenEmpty &&
              !this.shouldExcludeFromDeletion(block)
            ) {
              blocksToDelete.push(block.id);
              return;
            }
          }

          // 如果存在fa，说明存在样式，需要删除
          if (block.content) {
            let hasChanges = false;
            const newContent = block.content.map((fragment: any) => {
              let shouldClone = false;
              const newFragment = { ...fragment };

              // Check and remove inline styles
              if (removeTypes.includes("inline")) {
                if (newFragment.fa) {
                  delete newFragment.fa;
                  shouldClone = true;
                }
                if (newFragment.f) {
                  delete newFragment.f;
                  shouldClone = true;
                }
              }

              // Check and remove links
              if (removeTypes.includes("link")) {
                if (newFragment.l) {
                  newFragment.t = "t";
                  delete newFragment.l;
                  shouldClone = true;
                }
              }

              // Track if any changes occurred in this block
              if (shouldClone) hasChanges = true;

              // If changes were made, return the new object; otherwise return original
              return shouldClone ? newFragment : fragment;
            });

            if (hasChanges) {
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

        for (const child of blockTree) {
          processBlock(child);
        }

        // 5. Apply updates
        if (blocksToDelete.length > 0) {
          await orca.commands.invokeEditorCommand(
            "core.editor.deleteBlocks",
            null,
            blocksToDelete,
          );
        }

        if (updates.length > 0) {
          await orca.commands.invokeEditorCommand(
            "core.editor.setBlocksContent",
            null, // cursor data not strictly needed for batch content update if we don't care about restoring cursor exactly here
            updates,
            false, // setBackCursor
          );
        }

        if (updates.length > 0 || blocksToDelete.length > 0) {
          // Notify user
          const messages = [];
          if (updates.length > 0)
            messages.push(`Updated ${updates.length} blocks`);
          if (blocksToDelete.length > 0)
            messages.push(`Deleted ${blocksToDelete.length} empty blocks`);

          orca.broadcasts.broadcast("core.notify", {
            type: "success",
            message: messages.join(". "),
          });
        } else {
          orca.broadcasts.broadcast("core.notify", {
            type: "info",
            message: "No blocks needed removing styles or deleting.",
          });
        }
      },
      t("Remove Style"),
    );

    this.logger.info(`${this.name} loaded.`);
  }

  public async unload(): Promise<void> {
    orca.commands.unregisterCommand(`${this.name}.remove-style`);
    this.logger.info(`${this.name} unloaded.`);
  }

  public renderHeadbarButton(): React.ReactNode {
    const Button = orca.components.Button;
    const HoverContextMenu = orca.components.HoverContextMenu;
    const MenuText = orca.components.MenuText;

    return (
      <HoverContextMenu
        menu={(closeMenu: () => void) => (
          <>
            <MenuText
              title={t("remove all styles")}
              onClick={async () => {
                closeMenu();
                await orca.commands.invokeCommand(`${this.name}.remove-style`, [
                  "inline",
                  "link",
                ]);
              }}
            />
            <MenuText
              title={t("remove inline style")}
              onClick={async () => {
                closeMenu();
                await orca.commands.invokeCommand(`${this.name}.remove-style`, [
                  "inline",
                ]);
              }}
            />
            <MenuText
              title={t("remove link style")}
              onClick={async () => {
                closeMenu();
                await orca.commands.invokeCommand(`${this.name}.remove-style`, [
                  "link",
                ]);
              }}
            />
            <MenuText
              title={t("remove empty lines")}
              onClick={async () => {
                closeMenu();
                await orca.commands.invokeCommand(`${this.name}.remove-style`, [
                  "emptyLine",
                ]);
              }}
            />
          </>
        )}
      >
        <Button
          title={t("remove all")}
          variant="plain"
          onClick={async () =>
            orca.commands.invokeCommand(`${this.name}.remove-style`, [
              "inline",
              "link",
              "emptyLine",
            ])
          }
        >
          <i className="ti ti-brackets-angle-off" />
        </Button>
      </HoverContextMenu>
    );
  }

  protected renderHeadbarMenuItems(closeMenu: () => void): React.ReactNode[] {
    const MenuText = orca.components.MenuText;
    return [
      React.createElement(MenuText, {
        key: "remove-all-styles",
        preIcon: "ti ti-clear-formatting",
        title: t("remove all styles"),
        onClick: async () => {
          closeMenu();
          await orca.commands.invokeCommand(`${this.name}.remove-style`, [
            "inline",
            "link",
            "emptyLine",
          ]);
        },
      }),
      React.createElement(MenuText, {
        key: "remove-inline-style",
        preIcon: "ti ti-brackets-angle-off",
        title: t("remove inline style"),
        onClick: async () => {
          closeMenu();
          await orca.commands.invokeCommand(`${this.name}.remove-style`, [
            "inline",
          ]);
        },
      }),
      React.createElement(MenuText, {
        key: "remove-link-style",
        preIcon: "ti ti-brackets-angle-off",
        title: t("remove link style"),
        onClick: async () => {
          closeMenu();
          await orca.commands.invokeCommand(`${this.name}.remove-style`, [
            "link",
          ]);
        },
      }),
      React.createElement(MenuText, {
        key: "remove-empty-lines",
        preIcon: "ti ti-brackets-angle-off",
        title: t("remove empty lines"),
        onClick: async () => {
          closeMenu();
          await orca.commands.invokeCommand(`${this.name}.remove-style`, [
            "emptyLine",
          ]);
        },
      }),
      React.createElement(orca.components.MenuSeparator, {
        key: "sep-settings",
      }),
    ];
  }

  /**
   * 判断是否应该排除删除
   * @param block
   * @returns true 表示排除（不删除）
   */
  private shouldExcludeFromDeletion(block: any): boolean {
    const blockRepr = getRepr(block);

    // 排除非文本类型的 block：比如 hr，考虑到还有自定义块的情况，仅清理文本类型的空块
    if (blockRepr.type !== "text") {
      return true;
    }

    return false;
  }
}
