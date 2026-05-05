import React, { useState } from "react";
import { BasePlugin } from "@/libs/BasePlugin";
import { t } from "@/libs/l10n";
import { SettingsSection } from "@/components/SettingsItem";

export default class EditorCommandsPlugin extends BasePlugin {
  private registeredCommands: Set<string> = new Set();

  public async load(): Promise<void> {
    await this.registerStaticCommands();
    this.logger.info(`${this.name} loaded.`);
  }

  private async registerStaticCommands() {
    const commandId = `${this.name}.copy-text-as-ref`;
    orca.commands.registerEditorCommand(
      commandId,
      async ([_panelId, _rootBlockId, cursor]) => {
        if (!cursor || !cursor.anchor) {
          orca.notify("warn", t("Please place cursor in editor first."));
          return null;
        }

        const selectedText = window.getSelection()?.toString().trim();
        if (!selectedText) {
          orca.notify("warn", t("No text selected"));
          return null;
        }

        const blockId = cursor.anchor.blockId;

        const jsonToCopy = {
          type: "orca-tags",
          content: [
            { t: "r", v: blockId, a: selectedText }
          ]
        };

        try {
          await navigator.clipboard.writeText(JSON.stringify(jsonToCopy));
          orca.notify("success", t("Copied selected text as block ref (JSON)"));
        } catch (e) {
          orca.notify("error", t("Failed to copy to clipboard"));
        }

        return null;
      },
      () => {},
      { label: t("Copy Text as Block Ref (JSON)") }
    );

    this.registeredCommands.add(commandId);
    
    // Register toolbar button
    const toolbarButtonId = `${this.name}.copy-text-as-ref-button`;
    orca.toolbar.registerToolbarButton(toolbarButtonId, {
      icon: "ti ti-link",
      tooltip: t("Copy Text as Block Ref (JSON)"),
      command: commandId,
    });

    const settings = this.getSettings();
    const shortcut = settings.copyAsRefShortcut;
    if (shortcut) {
      try {
        await orca.shortcuts.assign(shortcut, commandId);
      } catch (e) {
        this.logger.error(`Failed to assign shortcut ${shortcut}`, e);
      }
    }
  }

  public async unload(): Promise<void> {
    const toolbarButtonId = `${this.name}.copy-text-as-ref-button`;
    try {
      orca.toolbar.unregisterToolbarButton(toolbarButtonId);
    } catch (e) {
      this.logger.warn(`Failed to unregister toolbar button ${toolbarButtonId}`, e);
    }

    for (const commandId of this.registeredCommands) {
      try {
        await orca.shortcuts.assign("", commandId);
        orca.commands.unregisterCommand(commandId);
      } catch (e) {
        this.logger.warn(`Failed to unregister ${commandId}`, e);
      }
    }
    this.registeredCommands.clear();
    this.logger.info(`${this.name} unloaded.`);
  }

  protected settingsComponent = EditorCommandsSettings;

  protected async onConfigChanged(_newConfig: any): Promise<void> {
    if (this.isLoaded) {
      await this.unload();
      await this.load();
    }
  }
}

function EditorCommandsSettings({ plugin }: { plugin: EditorCommandsPlugin }) {
  const settings = plugin["getSettings"]();
  const [copyAsRefShortcut, setCopyAsRefShortcut] = useState<string>(
    settings.copyAsRefShortcut || "",
  );

  const handleSave = async (val: string) => {
    setCopyAsRefShortcut(val);
    await plugin["updateSettings"]({
      copyAsRefShortcut: val,
    });
  };

  const Input = orca.components.Input;

  return (
    <SettingsSection title={t("Editor Commands")}>
      <div style={{ marginBottom: "24px" }}>
        <div style={{ fontSize: "0.9em", marginBottom: "8px", opacity: 0.8 }}>
          {t("Shortcut for Copy Text as Block Ref (JSON)")}
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <Input
            value={copyAsRefShortcut}
            onChange={(e: any) => handleSave(e.target.value)}
            placeholder={t("e.g. ctrl+shift+c")}
            style={{ flex: 1 }}
          />
        </div>
      </div>
    </SettingsSection>
  );
}
