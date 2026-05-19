import React, { useState } from "react";
import { BasePlugin } from "@/libs/BasePlugin";
import { t } from "@/libs/l10n";
import { SettingsItem, SettingsSection } from "@/components/SettingsItem";
import { PropType } from "@/libs/consts";
import { DataImporter } from "@/libs/DataImporter";
import type { Block } from "../orca.d.ts";

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

  public async load(): Promise<void> {
    if (orca.blockMenuCommands?.registerBlockMenuCommand) {
      // 注册块流转命令（支持多选）
      orca.blockMenuCommands.registerBlockMenuCommand(
        `${this.name}.flow-blocks`,
        {
          worksOnMultipleBlocks: true,
          render: (blockIds: number[], _rootBlockId: number, close: () => void) => {
            if (!blockIds || blockIds.length === 0) return null;
            const ids = Array.isArray(blockIds) ? blockIds : [blockIds];

            const settings = this.getSettings();
            const MenuText = orca.components.MenuText;
            const MenuSeparator = orca.components.MenuSeparator;

            // 检查开启状态
            const options = [
              {
                id: "today_move",
                enabled: settings.enableTodayMove !== false,
                title: t("Move to Today"),
                icon: "ti ti-calendar",
                onClick: () => this.handleFlow("move", "today", ids),
              },
              {
                id: "today_ref",
                enabled: settings.enableTodayRef !== false,
                title: t("Send Ref to Today"),
                icon: "ti ti-calendar-share",
                onClick: () => this.handleFlow("ref", "today", ids),
              },
              {
                id: "tomorrow_move",
                enabled: settings.enableTomorrowMove !== false,
                title: t("Move to Tomorrow"),
                icon: "ti ti-calendar-plus",
                onClick: () => this.handleFlow("move", "tomorrow", ids),
              },
              {
                id: "tomorrow_ref",
                enabled: settings.enableTomorrowRef !== false,
                title: t("Send Ref to Tomorrow"),
                icon: "ti ti-calendar-stats",
                onClick: () => this.handleFlow("ref", "tomorrow", ids),
              },
              {
                id: "inbox_move",
                enabled: settings.enableInboxMove !== false,
                title: t("Move to Inbox"),
                icon: "ti ti-inbox",
                onClick: () => this.handleFlow("move", "inbox", ids),
              },
              {
                id: "inbox_ref",
                enabled: settings.enableInboxRef !== false,
                title: t("Send Ref to Inbox"),
                icon: "ti ti-archive",
                onClick: () => this.handleFlow("ref", "inbox", ids),
              },
            ].filter((o) => o.enabled);

            if (options.length === 0) return null;

            return (
              <React.Fragment>
                <MenuSeparator />
                {options.map((opt) => (
                  <MenuText
                    key={opt.id}
                    preIcon={opt.icon}
                    title={opt.title}
                    onClick={() => {
                      close();
                      opt.onClick();
                    }}
                  />
                ))}
              </React.Fragment>
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
        `${this.name}.flow-blocks`,
      );
    }
    this.logger.debug(`${this.name} unloaded.`);
  }

  protected async onConfigChanged(newConfig: any): Promise<void> {
    await super.onConfigChanged(newConfig);
    await this.ensureInboxTagSchema();
  }

  /**
   * 确保收件箱标签块及 Schema 存在
   */
  private async ensureInboxTagSchema(): Promise<Block | null> {
    const settings = this.getSettings();
    const tag = settings.targetTag || "收件箱";
    if (!tag) return null;

    try {
      let tagBlock = (await orca.invokeBackend(
        "get-block-by-alias",
        tag,
      )) as Block | null;

      if (!tagBlock) {
        this.logger.debug(`Inbox tag ${tag} not found, creating...`);
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
      return tagBlock;
    } catch (e) {
      this.logger.error("Failed to ensure inbox tag schema", e);
      return null;
    }
  }

  /**
   * 获取流转目标块 ID
   */
  private async getTargetBlockId(
    type: "today" | "tomorrow" | "inbox",
  ): Promise<number | null> {
    try {
      if (type === "today") {
        const journal = await orca.invokeBackend("get-journal-block", new Date());
        return journal ? (journal as Block).id : null;
      }

      if (type === "tomorrow") {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const journal = await orca.invokeBackend(
          "get-journal-block",
          tomorrow,
        );
        return journal ? (journal as Block).id : null;
      }

      if (type === "inbox") {
        const tagBlock = await this.ensureInboxTagSchema();
        return tagBlock ? tagBlock.id : null;
      }
    } catch (e) {
      this.logger.error(`Failed to get target block ID for ${type}`, e);
    }
    return null;
  }

  /**
   * 执行流转核心逻辑
   */
  private async handleFlow(
    action: "move" | "ref",
    type: "today" | "tomorrow" | "inbox",
    blockIds: number[],
  ) {
    const targetId = await this.getTargetBlockId(type);
    if (!targetId) {
      orca.notify(
        "error",
        type === "inbox"
          ? t("Inbox tag block not found or failed to create")
          : t("Failed to process block flow"),
      );
      return;
    }

    // 防止循环引用/移动到自身
    if (blockIds.includes(targetId)) {
      orca.notify("warn", t("Cannot move or reference target block into itself"));
      return;
    }

    try {
      if (action === "move") {
        // 物理移动
        await orca.commands.invokeEditorCommand(
          "core.editor.moveBlocks",
          null,
          blockIds,
          targetId,
          "lastChild",
        );

        let successMsg = "";
        if (type === "today") {
          successMsg = t("Moved ${count} blocks to Today's journal", {
            count: blockIds.length.toString(),
          });
        } else if (type === "tomorrow") {
          successMsg = t("Moved ${count} blocks to Tomorrow's journal", {
            count: blockIds.length.toString(),
          });
        } else {
          successMsg = t("Moved ${count} blocks to Inbox", {
            count: blockIds.length.toString(),
          });
        }
        orca.notify("success", successMsg);
      } else {
        // 发送引用
        const targetBlock =
          orca.state.blocks[targetId] ||
          (await orca.invokeBackend("get-block", targetId));

        if (!targetBlock) {
          throw new Error("Target block not found in memory or backend");
        }

        // 拼接 [[blockId]] 链接文本
        const blockContent = blockIds.map((id) => `[[${id}]]`).join("\n");

        await orca.commands.invokeEditorCommand(
          "core.editor.batchInsertText",
          null,
          targetBlock,
          "lastChild",
          blockContent,
        );

        let successMsg = "";
        if (type === "today") {
          successMsg = t("Sent ${count} refs to Today's journal", {
            count: blockIds.length.toString(),
          });
        } else if (type === "tomorrow") {
          successMsg = t("Sent ${count} refs to Tomorrow's journal", {
            count: blockIds.length.toString(),
          });
        } else {
          successMsg = t("Sent ${count} refs to Inbox", {
            count: blockIds.length.toString(),
          });
        }
        orca.notify("success", successMsg);
      }
    } catch (e) {
      this.logger.error("Block flow operation failed", e);
      orca.notify("error", t("Failed to process block flow"));
    }
  }
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
        {/* Inbox 标签设置 */}
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

        {/* 菜单项开关 */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {[
            { key: "enableTodayMove", label: t("Enable 'Move to Today'") },
            { key: "enableTodayRef", label: t("Enable 'Send Ref to Today'") },
            { key: "enableTomorrowMove", label: t("Enable 'Move to Tomorrow'") },
            { key: "enableTomorrowRef", label: t("Enable 'Send Ref to Tomorrow'") },
            { key: "enableInboxMove", label: t("Enable 'Move to Inbox'") },
            { key: "enableInboxRef", label: t("Enable 'Send Ref to Inbox'") },
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
