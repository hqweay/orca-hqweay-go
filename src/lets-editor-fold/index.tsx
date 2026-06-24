import React, { useState } from "react";
import { BasePlugin } from "@/libs/BasePlugin";
import { t } from "@/libs/l10n";
import { SettingsSection } from "@/components/SettingsItem";
import { executeEditorExpand } from "./logic";

export default class EditorFoldPlugin extends BasePlugin {
  private registeredEditorCommands: Set<string> = new Set();

  public async load(): Promise<void> {
    await this.registerCommands();
    this.logger.info(`${this.name} loaded.`);
  }

  private async registerCommands() {
    const settings = this.getSettings();

    // 1. Block Context Menu
    if (settings.enableContextMenu !== false && orca.blockMenuCommands?.registerBlockMenuCommand) {
      orca.blockMenuCommands.registerBlockMenuCommand(`${this.name}.expand-to-same-level`, {
        worksOnMultipleBlocks: false,
        render: (blockIds, rootBlockId, close) => {
          if (!blockIds || typeof blockIds !== "number") return null;

          const MenuText = orca.components.MenuText;
          if (!MenuText) return null;

          return (
            <MenuText
              preIcon="ti ti-fold-down"
              title={t("Expand to this level")}
              onClick={async () => {
                close();
                // Calculate depth relative to root (1 = direct child, 2 = grandchild, etc.)
                let depth = 1;
                if (blockIds !== rootBlockId) {
                  let curr = orca.state.blocks[blockIds];
                  while (curr && curr.parent && Number(curr.parent) !== rootBlockId) {
                    depth++;
                    curr = orca.state.blocks[Number(curr.parent)];
                  }
                }
                await executeEditorExpand(depth, rootBlockId, this.logger);
              }}
            />
          );
        },
      });
    }

    // 2. Editor Commands (1 to 5)
    if (settings.enableGlobalCommands !== false) {
      for (let i = 1; i <= 5; i++) {
        const commandId = `${this.name}.expand-to-${i}`;
        orca.commands.registerEditorCommand(
          commandId,
          async ([panelId, rootBlockId, cursor]) => {
            if (!rootBlockId) return null;
            await executeEditorExpand(i, rootBlockId, this.logger);
            return null;
          },
          () => {},
          { label: t(`Expand to Level ${i}`) }
        );
        this.registeredEditorCommands.add(commandId);
      }
    }
  }

  public async unload(): Promise<void> {
    // Unregister block menu
    if (orca.blockMenuCommands?.unregisterBlockMenuCommand) {
      orca.blockMenuCommands.unregisterBlockMenuCommand(`${this.name}.expand-to-same-level`);
    }

    // Unregister editor commands
    for (const commandId of this.registeredEditorCommands) {
      try {
        orca.commands.unregisterCommand(commandId);
      } catch (e) {
        this.logger.warn(`Failed to unregister ${commandId}`, e);
      }
    }
    this.registeredEditorCommands.clear();

    this.logger.info(`${this.name} unloaded.`);
  }

  protected settingsComponent = EditorFoldSettings;

  protected async onConfigChanged(_newConfig: any): Promise<void> {
    if (this.isLoaded) {
      await this.unload();
      await this.load();
    }
  }
}

function EditorFoldSettings({ plugin }: { plugin: EditorFoldPlugin }) {
  const settings = plugin["getSettings"]();
  const [enableContextMenu, setEnableContextMenu] = useState<boolean>(
    settings.enableContextMenu !== false
  );
  const [enableGlobalCommands, setEnableGlobalCommands] = useState<boolean>(
    settings.enableGlobalCommands !== false
  );

  const handleToggle = async (field: string, val: boolean) => {
    if (field === "enableContextMenu") setEnableContextMenu(val);
    if (field === "enableGlobalCommands") setEnableGlobalCommands(val);
    await plugin["updateSettings"]({
      [field]: val,
    });
  };

  const Checkbox = orca.components.Checkbox;

  return (
    <SettingsSection title={t("Editor Fold Options")}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "12px",
        }}
      >
        <Checkbox
          checked={enableContextMenu}
          onChange={(e: { checked: boolean }) =>
            handleToggle("enableContextMenu", e.checked)
          }
        />
        <div style={{ fontSize: "0.9em", opacity: 0.8 }}>
          {t("Enable Block Context Menu Item (Expand to this level)")}
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
          checked={enableGlobalCommands}
          onChange={(e: { checked: boolean }) =>
            handleToggle("enableGlobalCommands", e.checked)
          }
        />
        <div style={{ fontSize: "0.9em", opacity: 0.8 }}>
          {t("Enable Global Editor Commands (Expand to Level 1-5)")}
        </div>
      </div>
    </SettingsSection>
  );
}
