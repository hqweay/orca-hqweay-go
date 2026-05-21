import { setupL10N, t } from "@/libs/l10n";
import { BasePlugin } from "@/libs/BasePlugin";
import React from "react";
import { ensureBlockInState, getRepr } from "@/libs/utils";
import { SettingsSection, SettingsItem } from "@/components/SettingsItem";

export default class FormatPlugin extends BasePlugin {
  protected headbarButtonId = `${this.name}.remove-style`;

  public async load(): Promise<void> {
    orca.commands.registerCommand(
      `${this.name}.remove-style`,
      async (removeTypes?: string[]) => {
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

        // Determine types to process based on argument or settings
        const settings = this.getSettings();
        const defaultTypes: string[] = [];
        if (settings.enableInline !== false) defaultTypes.push("inline");
        if (settings.enableLink !== false) defaultTypes.push("link");
        if (settings.enableEmptyLine !== false) defaultTypes.push("emptyLine");
        if (settings.enableAutoHeading !== false) defaultTypes.push("autoHeading");

        const typesToProcess = removeTypes || defaultTypes;
        if (typesToProcess.length === 0) {
          orca.broadcasts.broadcast("core.notify", {
            type: "info",
            message: t("No styles selected to remove."),
          });
          return;
        }

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
        const reprUpdates: { id: number; _repr: any }[] = [];
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

          // Handling "autoHeading"
          if (typesToProcess.includes("autoHeading")) {
            const repr = getRepr(block);
            if (repr && repr.type === "heading" && repr.level !== -1) {
              reprUpdates.push({
                id: block.id,
                _repr: { ...repr, level: -1 },
              });
            }
          }

          // Handling "remove empty lines"
          if (typesToProcess.includes("emptyLine")) {
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
              if (typesToProcess.includes("inline")) {
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
              if (typesToProcess.includes("link")) {
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
        const rootBlock = await ensureBlockInState(rootBlockId);
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

        if (reprUpdates.length > 0) {
          for (const update of reprUpdates) {
            await orca.commands.invokeEditorCommand(
              "core.editor.setProperties",
              null,
              [update.id],
              [{ name: "_repr", value: update._repr, type: 0 }],
            );
          }
        }

        if (
          updates.length > 0 ||
          blocksToDelete.length > 0 ||
          reprUpdates.length > 0
        ) {
          // Notify user
          const messages = [];
          if (updates.length > 0)
            messages.push(`Updated ${updates.length} blocks`);
          if (reprUpdates.length > 0)
            messages.push(`Converted ${reprUpdates.length} headings`);
          if (blocksToDelete.length > 0)
            messages.push(`Deleted ${blocksToDelete.length} empty blocks`);

          orca.broadcasts.broadcast("core.notify", {
            type: "success",
            message: messages.join(". "),
          });
        } else {
          orca.broadcasts.broadcast("core.notify", {
            type: "info",
            message: "No blocks needed processing.",
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

  public getDefaultSettings(): any {
    return {
      ...super.getDefaultSettings(),
      enableInline: true,
      enableLink: true,
      enableEmptyLine: true,
      enableAutoHeading: true,
    };
  }

  public renderCustomSettings(
    settings: any,
    updateSettings: (val: any) => void,
  ): React.ReactNode {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        <SettingsSection title={t("Feature Settings")}>
          <SettingsItem
            label={t("remove inline style")}
            description={t("Enable clearing of inline styles like colors, bold, etc.")}
          >
            <orca.components.Checkbox
              checked={settings.enableInline !== false}
              onChange={({ checked }) => updateSettings({ enableInline: checked })}
            />
          </SettingsItem>
          <SettingsItem
            label={t("remove link style")}
            description={t("Enable clearing of hyperlinks while keeping the text.")}
          >
            <orca.components.Checkbox
              checked={settings.enableLink !== false}
              onChange={({ checked }) => updateSettings({ enableLink: checked })}
            />
          </SettingsItem>
          <SettingsItem
            label={t("remove empty lines")}
            description={t("Enable deletion of empty lines/blocks.")}
          >
            <orca.components.Checkbox
              checked={settings.enableEmptyLine !== false}
              onChange={({ checked }) => updateSettings({ enableEmptyLine: checked })}
            />
          </SettingsItem>
          <SettingsItem
            label={t("convert to auto headings")}
            description={t("Enable converting text styled like headings to real heading blocks.")}
          >
            <orca.components.Checkbox
              checked={settings.enableAutoHeading !== false}
              onChange={({ checked }) => updateSettings({ enableAutoHeading: checked })}
            />
          </SettingsItem>
        </SettingsSection>
      </div>
    );
  }

  public renderHeadbarButton(): React.ReactNode {
    const Button = orca.components.Button;
    const HoverContextMenu = orca.components.HoverContextMenu;
    const MenuText = orca.components.MenuText;
    const settings = this.getSettings();

    // Check which features are enabled
    const inlineEnabled = settings.enableInline !== false;
    const linkEnabled = settings.enableLink !== false;
    const emptyLineEnabled = settings.enableEmptyLine !== false;
    const autoHeadingEnabled = settings.enableAutoHeading !== false;

    // Build list of types to clear for the main button
    const activeTypes: string[] = [];
    if (inlineEnabled) activeTypes.push("inline");
    if (linkEnabled) activeTypes.push("link");
    if (emptyLineEnabled) activeTypes.push("emptyLine");

    return (
      <HoverContextMenu
        menu={(closeMenu: () => void) => (
          <>
            {inlineEnabled && linkEnabled && (
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
            )}
            {inlineEnabled && (
              <MenuText
                title={t("remove inline style")}
                onClick={async () => {
                  closeMenu();
                  await orca.commands.invokeCommand(`${this.name}.remove-style`, [
                    "inline",
                  ]);
                }}
              />
            )}
            {linkEnabled && (
              <MenuText
                title={t("remove link style")}
                onClick={async () => {
                  closeMenu();
                  await orca.commands.invokeCommand(`${this.name}.remove-style`, [
                    "link",
                  ]);
                }}
              />
            )}
            {emptyLineEnabled && (
              <MenuText
                title={t("remove empty lines")}
                onClick={async () => {
                  closeMenu();
                  await orca.commands.invokeCommand(`${this.name}.remove-style`, [
                    "emptyLine",
                  ]);
                }}
              />
            )}
            {autoHeadingEnabled && (
              <MenuText
                title={t("convert to auto headings")}
                onClick={async () => {
                  closeMenu();
                  await orca.commands.invokeCommand(`${this.name}.remove-style`, [
                    "autoHeading",
                  ]);
                }}
              />
            )}
          </>
        )}
      >
        <Button
          title={t("remove all")}
          variant="plain"
          onClick={async () => {
            if (activeTypes.length > 0) {
              await orca.commands.invokeCommand(
                `${this.name}.remove-style`,
                activeTypes,
              );
            } else {
              orca.broadcasts.broadcast("core.notify", {
                type: "info",
                message: t("No styles selected to remove."),
              });
            }
          }}
        >
          <i className="ti ti-brackets-angle-off" />
        </Button>
      </HoverContextMenu>
    );
  }

  protected renderHeadbarMenuItems(closeMenu: () => void): React.ReactNode[] {
    const MenuText = orca.components.MenuText;
    const settings = this.getSettings();
    const items: React.ReactNode[] = [];

    const inlineEnabled = settings.enableInline !== false;
    const linkEnabled = settings.enableLink !== false;
    const emptyLineEnabled = settings.enableEmptyLine !== false;
    const autoHeadingEnabled = settings.enableAutoHeading !== false;

    // Remove all styles: clears whatever of (inline, link, emptyLine) are enabled
    const removeAllTypes: string[] = [];
    if (inlineEnabled) removeAllTypes.push("inline");
    if (linkEnabled) removeAllTypes.push("link");
    if (emptyLineEnabled) removeAllTypes.push("emptyLine");

    if (removeAllTypes.length > 0) {
      items.push(
        React.createElement(MenuText, {
          key: "remove-all-styles",
          preIcon: "ti ti-clear-formatting",
          title: t("remove all styles"),
          onClick: async () => {
            closeMenu();
            await orca.commands.invokeCommand(
              `${this.name}.remove-style`,
              removeAllTypes,
            );
          },
        }),
      );
    }

    if (inlineEnabled) {
      items.push(
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
      );
    }

    if (linkEnabled) {
      items.push(
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
      );
    }

    if (emptyLineEnabled) {
      items.push(
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
      );
    }

    if (autoHeadingEnabled) {
      // Add a separator before heading if other items exist
      if (items.length > 0) {
        items.push(
          React.createElement(orca.components.MenuSeparator, {
            key: "sep-headings",
          }),
        );
      }
      items.push(
        React.createElement(MenuText, {
          key: "convert-auto-headings",
          preIcon: "ti ti-heading",
          title: t("convert to auto headings"),
          onClick: async () => {
            closeMenu();
            await orca.commands.invokeCommand(`${this.name}.remove-style`, [
              "autoHeading",
            ]);
          },
        }),
      );
    }

    if (items.length > 0) {
      items.push(
        React.createElement(orca.components.MenuSeparator, {
          key: "sep-settings",
        }),
      );
    }

    return items;
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
