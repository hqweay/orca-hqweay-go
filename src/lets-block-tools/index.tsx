import React, { useState } from "react";
import { BasePlugin } from "@/libs/BasePlugin";
import { t } from "@/libs/l10n";
import { SettingsSection } from "@/components/SettingsItem";
import { DbId } from "../orca";

export default class BlockToolsPlugin extends BasePlugin {
  public async load(): Promise<void> {
    this.registerBlockMenuCommands();
    this.logger.info(`${this.name} loaded.`);
  }

  private registerBlockMenuCommands() {
    if (!orca.blockMenuCommands?.registerBlockMenuCommand) return;

    orca.blockMenuCommands.registerBlockMenuCommand(
      `${this.name}.push-children-to-ref`,
      {
        worksOnMultipleBlocks: true,
        render: (blockIds, _rootBlockId, close) => {
          const settings = this.getSettings();
          if (settings.enablePushToRef === false) return null;

          if (!blockIds || blockIds.length === 0) return null;

          // Find eligible blocks and their targets
          const eligibleMoves: { targetId: DbId; children: DbId[] }[] = [];

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
          }

          if (eligibleMoves.length === 0) return null;

          const MenuText = orca.components.MenuText;

          return (
            <MenuText
              preIcon="ti ti-arrow-merge"
              title={t("Push Children to Referenced Block")}
              onClick={async () => {
                close();
                let successCount = 0;
                try {
                  for (const move of eligibleMoves) {
                    await orca.commands.invokeEditorCommand(
                      "core.editor.moveBlocks",
                      null,
                      move.children,
                      move.targetId,
                      "lastChild",
                    );
                    successCount += move.children.length;
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
              }}
            />
          );
        },
      },
    );
  }

  public async unload(): Promise<void> {
    orca.blockMenuCommands.unregisterBlockMenuCommand(
      `${this.name}.push-children-to-ref`,
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

  const handleToggle = async (val: boolean) => {
    setEnablePushToRef(val);
    await plugin["updateSettings"]({ enablePushToRef: val });
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
          onChange={(e: { checked: boolean }) => handleToggle(e.checked)}
        />
        <div style={{ fontSize: "0.9em", opacity: 0.8 }}>
          {t("Enable Push Children to Referenced Block")}
        </div>
      </div>
    </SettingsSection>
  );
}
