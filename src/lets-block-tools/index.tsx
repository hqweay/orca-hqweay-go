import React, { useState } from "react";
import { BasePlugin } from "@/libs/BasePlugin";
import { t } from "@/libs/l10n";
import { SettingsSection } from "@/components/SettingsItem";
import { DbId } from "../orca";

export default class BlockToolsPlugin extends BasePlugin {
  public async load(): Promise<void> {
    this.registerPushCommand(false);
    this.registerPushCommand(true);
    this.logger.info(`${this.name} loaded.`);
  }

  private registerPushCommand(shouldDelete: boolean) {
    if (!orca.blockMenuCommands?.registerBlockMenuCommand) return;

    const commandId = shouldDelete
      ? `${this.name}.push-children-and-delete`
      : `${this.name}.push-children-to-ref`;

    orca.blockMenuCommands.registerBlockMenuCommand(commandId, {
      worksOnMultipleBlocks: true,
      render: (blockIds, _rootBlockId, close) => {
        const settings = this.getSettings();
        const enabled = shouldDelete
          ? settings.enablePushAndDelete !== false
          : settings.enablePushToRef !== false;

        if (!enabled) return null;
        if (!blockIds || blockIds.length === 0) return null;

        // Find eligible blocks and their targets
        const eligibleMoves: { targetId: DbId; children: DbId[] }[] = [];
        const processedBlockIds: DbId[] = [];

        for (const blockId of typeof blockIds === "number"
          ? [blockIds]
          : blockIds) {
          const block = orca.state.blocks[blockId];
          if (!block) continue;

          const isRefOnly =
            block.content?.length === 1 && block.content[0].t === "r";
          if (!isRefOnly) continue;

          if (!block.children || block.children.length === 0) continue;

          const refId = block.content![0].v;
          const targetRef = block.refs?.find((r) => r.id === refId);
          if (!targetRef) continue;

          eligibleMoves.push({
            targetId: targetRef.to,
            children: [...block.children],
          });
          processedBlockIds.push(blockId);
        }

        if (eligibleMoves.length === 0) return null;

        const MenuText = orca.components.MenuText;

        return (
          <MenuText
            preIcon={shouldDelete ? "ti ti-trash-x" : "ti ti-arrow-merge"}
            title={
              shouldDelete
                ? t("Push Children and Delete")
                : t("Push Children to Referenced Block")
            }
            onClick={async () => {
              close();
              await this.executePush(
                eligibleMoves,
                shouldDelete,
                processedBlockIds,
              );
            }}
          />
        );
      },
    });
  }

  private async executePush(
    moveInfo: { targetId: DbId; children: DbId[] }[],
    shouldDeleteSource: boolean,
    processedBlockIds: DbId[],
  ) {
    let successCount = 0;
    try {
      for (const move of moveInfo) {
        await orca.commands.invokeEditorCommand(
          "core.editor.moveBlocks",
          null,
          move.children,
          move.targetId,
          "lastChild",
        );
        successCount += move.children.length;
      }

      if (shouldDeleteSource && processedBlockIds.length > 0) {
        await orca.commands.invokeEditorCommand(
          "core.editor.deleteBlocks",
          null,
          processedBlockIds,
        );
      }

      orca.notify(
        "success",
        t("Moved {count} blocks to target", {
          count: successCount.toString(),
        }),
      );
    } catch (e) {
      orca.notify("error", t("Failed to move blocks"));
      this.logger.error("Failed to push children to ref", e);
    }
  }

  public async unload(): Promise<void> {
    orca.blockMenuCommands.unregisterBlockMenuCommand(
      `${this.name}.push-children-to-ref`,
    );
    orca.blockMenuCommands.unregisterBlockMenuCommand(
      `${this.name}.push-children-and-delete`,
    );
    this.logger.info(`${this.name} unloaded.`);
  }

  protected settingsComponent = BlockToolsSettings;

  protected async onConfigChanged(_newConfig: any): Promise<void> {
    // Block menu items are re-rendered each time the menu is opened.
  }
}

function BlockToolsSettings({ plugin }: { plugin: BlockToolsPlugin }) {
  const settings = plugin["getSettings"]();
  const [enablePushToRef, setEnablePushToRef] = useState<boolean>(
    settings.enablePushToRef !== false,
  );
  const [enablePushAndDelete, setEnablePushAndDelete] = useState<boolean>(
    settings.enablePushAndDelete !== false,
  );

  const handleToggle = async (field: string, val: boolean) => {
    if (field === "enablePushToRef") setEnablePushToRef(val);
    if (field === "enablePushAndDelete") setEnablePushAndDelete(val);
    await plugin["updateSettings"]({ [field]: val });
  };

  const Checkbox = orca.components.Checkbox;

  return (
    <SettingsSection title={t("Block Tools")}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "12px",
        }}
      >
        <Checkbox
          checked={enablePushToRef}
          onChange={(e: { checked: boolean }) =>
            handleToggle("enablePushToRef", e.checked)
          }
        />
        <div style={{ fontSize: "0.9em", opacity: 0.8 }}>
          {t("Enable Push Children to Referenced Block")}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "12px",
        }}
      >
        <Checkbox
          checked={enablePushAndDelete}
          onChange={(e: { checked: boolean }) =>
            handleToggle("enablePushAndDelete", e.checked)
          }
        />
        <div style={{ fontSize: "0.9em", opacity: 0.8 }}>
          {t("Enable Push Children and Delete")}
        </div>
      </div>
    </SettingsSection>
  );
}
