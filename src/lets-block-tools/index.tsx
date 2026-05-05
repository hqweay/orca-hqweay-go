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
        worksOnMultipleBlocks: false,
        render: (blockId, _rootBlockId, close) => {
          const settings = this.getSettings();
          if (settings.enablePushToRef === false) return null;

          const block = orca.state.blocks[blockId];
          if (!block) return null;

          // Condition: 1. Only one content fragment, which is a reference
          const isRefOnly =
            block.content?.length === 1 && block.content[0].t === "r";
          if (!isRefOnly) return null;

          // Condition: 2. Has children to move
          if (!block.children || block.children.length === 0) return null;

          const refId = block.content![0].v;
          const targetRef = block.refs?.find((r) => r.id === refId);
          if (!targetRef) return null;

          const targetBlockId = targetRef.to;
          const MenuText = orca.components.MenuText;

          return (
            <MenuText
              preIcon="ti ti-arrow-merge"
              title={t("Push Children to Referenced Block")}
              onClick={async () => {
                close();
                try {
                  const childrenToMove = [...block.children];
                  await orca.commands.invokeEditorCommand(
                    "core.editor.moveBlocks",
                    null,
                    childrenToMove,
                    targetBlockId,
                    "lastChild",
                  );
                  orca.notify(
                    "success",
                    t("Moved {count} blocks to target", {
                      count: childrenToMove.length.toString(),
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
