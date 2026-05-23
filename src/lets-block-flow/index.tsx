import React, { useState, useEffect } from "react";
import { BasePlugin } from "@/libs/BasePlugin";
import { t } from "@/libs/l10n";
import { SettingsItem, SettingsSection } from "@/components/SettingsItem";
import { PropType } from "@/libs/consts";
import { DataImporter } from "@/libs/DataImporter";
import type { Block } from "../orca.d.ts";
import { getRepr, ensureBlockInState } from "@/libs/utils";

export default class BlockFlowPlugin extends BasePlugin {
  protected settingsComponent = BlockFlowSettings;

  public getDefaultSettings(): any {
    return {
      targetTag: "收件箱",
      enableTodayMove: true,
      enableTodayRef: true,
      enableTomorrowMove: true,
      enableTomorrowRef: true,
      enableInboxMove: true,
      enableInboxRef: true,
    };
  }

  public getTargetTag(): string {
    const settings = this.getSettings();
    return settings.targetTag || "收件箱";
  }

  private injectStyles() {
    const style = document.createElement("style");
    style.textContent = `
      .orca-block-select-menu {
        max-width: 100% !important;
      }
    `;
    style.setAttribute("data-plugin", this.name);
    document.head.appendChild(style);
  }

  public async load(): Promise<void> {
    this.injectStyles();
    if (orca.blockMenuCommands?.registerBlockMenuCommand) {
      orca.blockMenuCommands.registerBlockMenuCommand(
        `${this.name}.move-blocks`,
        {
          worksOnMultipleBlocks: true,
          render: (
            blockIds: number[],
            _rootBlockId: number,
            close: () => void,
          ) => {
            return (
              <BlockFlowMenuItems
                plugin={this}
                action="move"
                blockIds={Array.isArray(blockIds) ? blockIds : [blockIds]}
                close={close}
              />
            );
          },
        },
      );
      orca.blockMenuCommands.registerBlockMenuCommand(
        `${this.name}.ref-blocks`,
        {
          worksOnMultipleBlocks: true,
          render: (
            blockIds: number[],
            _rootBlockId: number,
            close: () => void,
          ) => {
            return (
              <BlockFlowMenuItems
                plugin={this}
                action="ref"
                blockIds={Array.isArray(blockIds) ? blockIds : [blockIds]}
                close={close}
              />
            );
          },
        },
      );
    }

    await this.ensureInboxTagSchema();
    this.logger.debug(`${this.name} loaded.`);
  }

  public async unload(): Promise<void> {
    if (orca.blockMenuCommands?.unregisterBlockMenuCommand) {
      orca.blockMenuCommands.unregisterBlockMenuCommand(
        `${this.name}.move-blocks`,
      );
      orca.blockMenuCommands.unregisterBlockMenuCommand(
        `${this.name}.ref-blocks`,
      );
    }
    const style = document.querySelector(`style[data-plugin="${this.name}"]`);
    if (style) {
      style.remove();
    }
    this.logger.debug(`${this.name} unloaded.`);
  }

  protected async onConfigChanged(newConfig: any): Promise<void> {
    await super.onConfigChanged(newConfig);
    await this.ensureInboxTagSchema();
  }

  /**
   * 确保收件箱 Tag 元数据 Schema 的存在，以支持自动提示
   */
  private async ensureInboxTagSchema(): Promise<void> {
    const tag = this.getTargetTag();
    if (!tag) return;

    try {
      let tagBlock = (await orca.invokeBackend(
        "get-block-by-alias",
        tag,
      )) as Block | null;

      if (!tagBlock) {
        this.logger.debug(
          `Inbox tag ${tag} not found, creating tag definition block...`,
        );
        const newBlockId = (await orca.commands.invokeEditorCommand(
          "core.editor.insertBlock",
          null,
          null,
          "lastChild",
          [{ t: "t", v: tag }],
          { type: "text" },
        )) as number;

        if (newBlockId) {
          await orca.commands.invokeEditorCommand(
            "core.editor.createAlias",
            null,
            tag,
            newBlockId,
            true,
          );
          tagBlock = (await orca.invokeBackend(
            "get-block",
            newBlockId,
          )) as Block | null;
        }
      }

      if (tagBlock) {
        await DataImporter.syncTagSchema(tagBlock, [
          {
            name: "displayName",
            type: PropType.Text,
          },
        ]);
      }
    } catch (e) {
      this.logger.error("Failed to ensure inbox tag schema", e);
    }
  }

  /**
   * 读取块的显示名称
   */
  public getBlockDisplayName(block: Block): string {
    const targetTag = this.getTargetTag();

    // 1. 优先取标签上的 displayName
    const tagRef = (block.refs as any[])?.find(
      (r: any) =>
        r.type === 2 && (r.alias === targetTag || r.name === targetTag),
    );
    const displayName =
      tagRef?.data?.find((p: any) => p.name === "displayName")?.value ||
      (block.properties as any[])?.find((p: any) => p.name === "displayName")
        ?.value;
    if (displayName) return displayName;

    // 2. 取块文本
    if (block.text && block.text.trim()) {
      const text = block.text.trim();
      return text.length > 20 ? text.substring(0, 20) + "…" : text;
    }

    // 3. 取别名
    if (block.aliases && block.aliases.length > 0) return block.aliases[0];

    return `#${block.id}`;
  }

  /**
   * 执行流转核心逻辑
   */
  public async handleFlow(
    action: "move" | "ref",
    targetId: number,
    targetName: string,
    isJournal: boolean,
    blockIds: number[],
  ) {
    // 防止循环引用/移动到自身
    if (blockIds.includes(targetId)) {
      orca.notify(
        "warn",
        t("Cannot move or reference target block into itself"),
      );
      return;
    }

    try {
      let targetBlock = await ensureBlockInState(targetId);

      if (!targetBlock) {
        throw new Error("Target block not found");
      }

      if (action === "move") {
        // 物理移动
        await orca.commands.invokeEditorCommand(
          "core.editor.moveBlocks",
          null,
          blockIds,
          targetId,
          "lastChild",
        );

        const successMsg = isJournal
          ? t("Moved ${count} blocks to ${name}", {
            count: blockIds.length.toString(),
            name: targetName,
          })
          : t("Moved ${count} blocks to Inbox: ${name}", {
            count: blockIds.length.toString(),
            name: targetName,
          });

        orca.notify("success", successMsg);
      } else {
        // 发送引用 (使用 batchInsertText 批量写入 [[blockId]])
        const blockContent = blockIds.map((id) => `[[${id}]]`).join("\n");

        await orca.commands.invokeEditorCommand(
          "core.editor.batchInsertText",
          null,
          targetBlock,
          "lastChild",
          blockContent,
        );

        const successMsg = isJournal
          ? t("Sent ${count} refs to ${name}", {
            count: blockIds.length.toString(),
            name: targetName,
          })
          : t("Sent ${count} refs to Inbox: ${name}", {
            count: blockIds.length.toString(),
            name: targetName,
          });

        orca.notify("success", successMsg);
      }
    } catch (e) {
      this.logger.error("Block flow operation failed", e);
      orca.notify("error", t("Failed to process block flow"));
    }
  }
}

// ─── 异步渲染的菜单项组件 ───────────────────────────────────────────────────────

interface FlowTarget {
  id: number;
  name: string;
  isJournal: boolean;
}

function BlockFlowMenuItems({
  plugin,
  action,
  blockIds,
  close,
}: {
  plugin: BlockFlowPlugin;
  action: "move" | "ref";
  blockIds: number[];
  close: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [todayTarget, setTodayTarget] = useState<FlowTarget | null>(null);
  const [tomorrowTarget, setTomorrowTarget] = useState<FlowTarget | null>(null);
  const [inboxTargets, setInboxTargets] = useState<FlowTarget[]>([]);

  const settings = plugin.getSettings();
  const targetTag = plugin.getTargetTag();

  // 检查选中的块中是否包含 journal 块，如果有则不渲染菜单项
  const hasJournal = blockIds.some((id) => {
    const block = orca.state.blocks[id];
    if (!block) return false;
    const repr = getRepr(block);
    return repr && repr.type === "journal";
  });

  if (hasJournal) return null;

  useEffect(() => {
    let active = true;

    async function loadTargets() {
      try {
        // 1. 获取今日日志
        const todayJournal = (await orca.invokeBackend(
          "get-journal-block",
          new Date(),
        )) as Block | null;

        // 2. 获取明日日志
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowJournal = (await orca.invokeBackend(
          "get-journal-block",
          tomorrow,
        )) as Block | null;

        // 3. 获取所有标记了收件箱标签的普通块
        const taggedBlocks = (await orca.invokeBackend("get-blocks-with-tags", [
          targetTag,
        ])) as Block[];

        if (!active) return;

        if (todayJournal) {
          setTodayTarget({
            id: todayJournal.id,
            name: todayJournal.text || t("Today's Journal"),
            isJournal: true,
          });
        }
        if (tomorrowJournal) {
          setTomorrowTarget({
            id: tomorrowJournal.id,
            name: tomorrowJournal.text || t("Tomorrow's Journal"),
            isJournal: true,
          });
        }

        if (taggedBlocks && taggedBlocks.length > 0) {
          const targets = taggedBlocks.map((b) => ({
            id: b.id,
            name: plugin.getBlockDisplayName(b),
            isJournal: false,
          }));
          setInboxTargets(targets);
        }
      } catch (e) {
        plugin["logger"].error("Failed to load flow targets", e);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadTargets();
    return () => {
      active = false;
    };
  }, [plugin, targetTag]);

  const MenuText = orca.components.MenuText;
  const MenuSeparator = orca.components.MenuSeparator;

  if (loading) {
    return (
      <React.Fragment>
        {/* <MenuSeparator /> */}
        <MenuText preIcon="ti ti-loader" title={t("Loading...")} disabled />
      </React.Fragment>
    );
  }

  const items: React.ReactNode[] = [];

  // Action Move Menu Items
  if (action === "move") {
    // 今日日志
    if (todayTarget && settings.enableTodayMove !== false) {
      items.push(
        <MenuText
          key="today_move"
          preIcon="ti ti-calendar"
          title={t("Move to Today")}
          onClick={() => {
            close();
            plugin.handleFlow(
              "move",
              todayTarget.id,
              t("Move to Today"),
              true,
              blockIds,
            );
          }}
        />,
      );
    }
    // 明日日志
    if (tomorrowTarget && settings.enableTomorrowMove !== false) {
      items.push(
        <MenuText
          key="tomorrow_move"
          preIcon="ti ti-calendar-plus"
          title={t("Move to Tomorrow")}
          onClick={() => {
            close();
            plugin.handleFlow(
              "move",
              tomorrowTarget.id,
              t("Move to Tomorrow"),
              true,
              blockIds,
            );
          }}
        />,
      );
    }
    // 收件箱
    if (settings.enableInboxMove !== false) {
      if (inboxTargets.length === 0) {
        items.push(
          <MenuText
            key="inbox_empty"
            preIcon="ti ti-info-circle"
            title={t(
              "No blocks tagged with #${tag} found. Please tag a block first.",
              {
                tag: targetTag,
              },
            )}
            disabled
          />,
        );
      } else {
        inboxTargets.forEach((target) => {
          items.push(
            <MenuText
              key={`inbox_move_${target.id}`}
              preIcon="ti ti-inbox"
              title={t("Move to Inbox: ${name}", { name: target.name })}
              onClick={() => {
                close();
                plugin.handleFlow(
                  "move",
                  target.id,
                  target.name,
                  false,
                  blockIds,
                );
              }}
            />,
          );
        });
      }
    }
  }

  // Action Ref Menu Items
  if (action === "ref") {
    // 今日日志
    if (todayTarget && settings.enableTodayRef !== false) {
      items.push(
        <MenuText
          key="today_ref"
          preIcon="ti ti-calendar-share"
          title={t("Send Ref to Today")}
          onClick={() => {
            close();
            plugin.handleFlow(
              "ref",
              todayTarget.id,
              t("Send Ref to Today"),
              true,
              blockIds,
            );
          }}
        />,
      );
    }
    // 明日日志
    if (tomorrowTarget && settings.enableTomorrowRef !== false) {
      items.push(
        <MenuText
          key="tomorrow_ref"
          preIcon="ti ti-calendar-stats"
          title={t("Send Ref to Tomorrow")}
          onClick={() => {
            close();
            plugin.handleFlow(
              "ref",
              tomorrowTarget.id,
              t("Send Ref to Tomorrow"),
              true,
              blockIds,
            );
          }}
        />,
      );
    }
    // 收件箱
    if (settings.enableInboxRef !== false) {
      if (inboxTargets.length === 0) {
        items.push(
          <MenuText
            key="inbox_empty"
            preIcon="ti ti-info-circle"
            title={t(
              "No blocks tagged with #${tag} found. Please tag a block first.",
              {
                tag: targetTag,
              },
            )}
            disabled
          />,
        );
      } else {
        inboxTargets.forEach((target) => {
          items.push(
            <MenuText
              key={`inbox_ref_${target.id}`}
              preIcon="ti ti-archive"
              title={t("Send Ref to Inbox: ${name}", { name: target.name })}
              onClick={() => {
                close();
                plugin.handleFlow(
                  "ref",
                  target.id,
                  target.name,
                  false,
                  blockIds,
                );
              }}
            />,
          );
        });
      }
    }
  }

  // Custom Search BlockSelect
  const BlockSelect = orca.components?.BlockSelect;
  if (BlockSelect) {
    const isMove = action === "move";
    const enableSearch = isMove
      ? settings.enableSearchMove !== false
      : settings.enableSearchRef !== false;

    if (enableSearch) {
      items.push(
        <div
          key="custom_search"
          style={{
            padding: "8px 12px",
            borderTop:
              items.length > 0
                ? "1px solid var(--b3-theme-surface-lighter)"
                : "none",
          }}
        >
          <div style={{ fontSize: "12px", opacity: 0.6, marginBottom: "8px" }}>
            {isMove
              ? t("Move to Searched Block...")
              : t("Send Ref to Searched Block...")}
          </div>
          <BlockSelect
            mode="block"
            selected={[]}
            onChange={async (selected) => {
              if (selected && selected.length > 0) {
                const targetId = parseInt(selected[0], 10);
                if (targetId) {
                  close();
                  try {
                    const targetBlock = await ensureBlockInState(targetId);
                    const targetName = targetBlock
                      ? plugin.getBlockDisplayName(targetBlock)
                      : `#${targetId}`;
                    plugin.handleFlow(
                      action,
                      targetId,
                      targetName,
                      false,
                      blockIds,
                    );
                  } catch (e) {
                    console.error("Search flow failed", e);
                  }
                }
              }
            }}
          />
        </div>,
      );
    }
  }

  if (items.length === 0) return null;

  const isMoveAction = action === "move";

  return (
    <React.Fragment>
      {/* <MenuSeparator /> */}
      <orca.components.ContextMenu
        placement="horizontal"
        defaultPlacement="right"
        alignment="top"
        menu={() => (
          <MenuText
            preIcon={isMoveAction ? "ti ti-folder-symlink" : "ti ti-link"}
            title={isMoveAction ? t("Move Block to...") : t("Send Ref to...")}
            postIcon="ti ti-chevron-right"
          >
            <orca.components.Menu>{items}</orca.components.Menu>
          </MenuText>
        )}
      >
        {(openMenu) => (
          <MenuText
            preIcon={isMoveAction ? "ti ti-folder-symlink" : "ti ti-link"}
            title={isMoveAction ? t("Move Block to...") : t("Send Ref to...")}
            postIcon="ti ti-chevron-right"
            onMouseEnter={(e) => {
              e.stopPropagation();
              e.preventDefault();
              openMenu(e);
            }}
          />
        )}
      </orca.components.ContextMenu>
    </React.Fragment>
  );
}

// ─── 设置界面组件 ─────────────────────────────────────────────────────────────

function BlockFlowSettings({ plugin }: { plugin: BlockFlowPlugin }) {
  const settings = plugin["getSettings"]();
  const [config, setConfig] = useState(settings);

  const updateConfig = async (key: string, value: any) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    await plugin["updateSettings"](newConfig);
  };

  const Checkbox = orca.components.Checkbox;
  const Input = orca.components.Input;

  const toggleOption = (key: string) => {
    updateConfig(key, !config[key]);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
      <SettingsSection title={t("Block Flow Settings")}>
        <SettingsItem
          label={t("Inbox Tag")}
          description={t(
            "Target tag for the custom Inbox. The tag block will act as the inbox page.",
          )}
        >
          <Input
            value={config.targetTag || "收件箱"}
            onChange={(e: any) => updateConfig("targetTag", e.target.value)}
          />
        </SettingsItem>

        <div style={{ height: "16px" }} />

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {[
            { key: "enableTodayMove", label: t("Enable 'Move to Today'") },
            { key: "enableTodayRef", label: t("Enable 'Send Ref to Today'") },
            {
              key: "enableTomorrowMove",
              label: t("Enable 'Move to Tomorrow'"),
            },
            {
              key: "enableTomorrowRef",
              label: t("Enable 'Send Ref to Tomorrow'"),
            },
            { key: "enableInboxMove", label: t("Enable 'Move to Inbox'") },
            { key: "enableInboxRef", label: t("Enable 'Send Ref to Inbox'") },
            { key: "enableSearchMove", label: t("Enable 'Move to Searched Block'") },
            { key: "enableSearchRef", label: t("Enable 'Send Ref to Searched Block'") },
          ].map((item) => (
            <div
              key={item.key}
              style={{ display: "flex", alignItems: "center", gap: "12px" }}
            >
              <Checkbox
                checked={config[item.key] !== false}
                onChange={() => toggleOption(item.key)}
              />
              <span style={{ fontSize: "0.9em", opacity: 0.9 }}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </SettingsSection>
    </div>
  );
}
