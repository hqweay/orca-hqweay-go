import { setupL10N, t } from "@/libs/l10n";
import { BasePlugin } from "@/libs/BasePlugin";
import { SettingsItem, SettingsSection } from "@/components/SettingsItem";
import React, { useState } from "react";

export default class FormatPlugin extends BasePlugin {
  protected settingsComponent = RemoveStyleSettings;

  public async load(): Promise<void> {
    const settings = this.getSettings();
    const headbarMode = settings.headbarMode || "actions";
    if (headbarMode === "standalone" || headbarMode === "both") {
      this.registerHeadbar();
    }

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

            if (isContentEmpty && isChildrenEmpty) {
              blocksToDelete.push(block.id);
              return;
            }
          }

          // 如果存在fa，说明存在样式，需要删除
          if (block.content) {
            block.content.forEach((fragment: any) => {
              //去除行内富文本
              if (removeTypes.includes("inline")) {
                fragment.fa && delete fragment.fa;
                fragment.f && delete fragment.f;
              }
              //去除链接
              if (removeTypes.includes("link")) {
                fragment.l && (fragment.t = "t");
                fragment.l && delete fragment.l;
              }
            });
            updates.push({
              id: block.id,
              content: block.content,
            });
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

  private registerHeadbar() {
    const Button = orca.components.Button;
    const HoverContextMenu = orca.components.HoverContextMenu;
    const MenuText = orca.components.MenuText;

    if (orca.state.headbarButtons[`${this.name}.remove-style`] == null) {
      orca.headbar.registerHeadbarButton(`${this.name}.remove-style`, () => (
        <HoverContextMenu
          menu={(closeMenu: () => void) => (
            <>
              <MenuText
                title={t("remove inline style")}
                onClick={async () => {
                  closeMenu();
                  await orca.commands.invokeCommand(
                    `${this.name}.remove-style`,
                    ["inline"],
                  );
                }}
              />
              <MenuText
                title={t("remove link style")}
                onClick={async () => {
                  closeMenu();
                  await orca.commands.invokeCommand(
                    `${this.name}.remove-style`,
                    ["link"],
                  );
                }}
              />
              <MenuText
                title={t("remove empty lines")}
                onClick={async () => {
                  closeMenu();
                  await orca.commands.invokeCommand(
                    `${this.name}.remove-style`,
                    ["emptyLine"],
                  );
                }}
              />
            </>
          )}
        >
          <Button
            title={t("remove all styles")}
            variant="plain"
            onClick={async () =>
              orca.commands.invokeCommand(`${this.name}.remove-style`, [
                "inline",
                "link",
              ])
            }
          >
            <i className="ti ti-brackets-angle-off" />
          </Button>
        </HoverContextMenu>
      ));
    }
  }

  protected async onConfigChanged(newConfig: any): Promise<void> {
    const headbarMode = newConfig.headbarMode || "actions";
    if (headbarMode === "standalone" || headbarMode === "both") {
      this.registerHeadbar();
    } else {
      orca.headbar.unregisterHeadbarButton(`${this.name}.remove-style`);
    }
  }

  public getHeadbarMenuItems(closeMenu: () => void): React.ReactNode[] {
    // Only return items if mode is 'actions' or 'both'
    const settings = this.getSettings();
    const headbarMode = settings.headbarMode || "actions";
    if (headbarMode === "standalone") {
      return [];
    }

    const MenuText = orca.components.MenuText;
    return [
      React.createElement(MenuText, {
        key: "remove-all-styles",
        preIcon: "ti ti-brackets-angle-off",
        title: t("remove all styles"),
        onClick: async () => {
          closeMenu();
          await orca.commands.invokeCommand(`${this.name}.remove-style`, [
            "inline",
            "link",
          ]);
        },
      }),
      React.createElement(MenuText, {
        key: "remove-inline-style",
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
        title: t("remove empty lines"),
        onClick: async () => {
          closeMenu();
          await orca.commands.invokeCommand(`${this.name}.remove-style`, [
            "emptyLine",
          ]);
        },
      }),
    ];
  }
}

function RemoveStyleSettings({ plugin }: { plugin: FormatPlugin }) {
  const settings = plugin["getSettings"]();
  const [headbarMode, setHeadbarMode] = useState(
    settings.headbarMode || "actions",
  );

  const updateMode = async (value: string) => {
    setHeadbarMode(value);
    await plugin.updateSettings({ headbarMode: value });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <SettingsSection title={t("Headbar Display Mode")}>
        <SettingsItem label={t("Display Mode")}>
          <orca.components.Select
            selected={[headbarMode]}
            options={[
              { value: "actions", label: t("Actions Menu") },
              { value: "standalone", label: t("Standalone Button") },
              { value: "both", label: t("Both") },
            ]}
            onChange={(selected) => updateMode(selected[0])}
          />
        </SettingsItem>
      </SettingsSection>
    </div>
  );
}
