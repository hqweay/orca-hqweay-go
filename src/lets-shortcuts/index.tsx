import React, { useState } from "react";
import { BasePlugin } from "@/libs/BasePlugin";
import { t } from "@/libs/l10n";
import { SettingsItem, SettingsSection } from "@/components/SettingsItem";

interface TagShortcutConfig {
  tag: string;
  shortcut: string;
}

export default class TagShortcutsPlugin extends BasePlugin {
  private registeredCommands: Set<string> = new Set();

  public async load(): Promise<void> {
    await this.reloadShortcuts();
    this.logger.info(`${this.name} loaded.`);
  }

  public async unload(): Promise<void> {
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

  private async reloadShortcuts(): Promise<void> {
    for (const commandId of this.registeredCommands) {
      try {
        await orca.shortcuts.assign("", commandId);
        orca.commands.unregisterCommand(commandId);
      } catch (e) {
        this.logger.warn(`Failed to unregister ${commandId}`, e);
      }
    }
    this.registeredCommands.clear();

    const settings = this.getSettings();
    const tags: TagShortcutConfig[] = settings.tags || [
      {
        tag: "碎碎念",
        shortcut: "ctrl+shift+t",
      },
    ];

    for (const config of tags) {
      if (!config.tag || !config.shortcut) continue;

      const commandId = `${this.name}.insert-tag-${config.tag}`;

      orca.commands.registerEditorCommand(
        commandId,
        async ([_panelId, _rootBlockId, cursor]) => {
          if (!cursor || !cursor.anchor) {
            orca.notify("warn", t("Please place cursor in editor first."));
            return null;
          }

          const { anchor } = cursor;
          const tagNames = config.tag
            .split(",")
            .map((t) => t.trim())
            .filter((t) => t.length > 0);

          for (const tag of tagNames) {
            await orca.commands.invokeEditorCommand(
              "core.editor.insertTag",
              null,
              anchor.blockId,
              tag,
            );
          }

          return null;
        },
        () => {},
        { label: `插入标签: ${config.tag}` },
      );

      try {
        await orca.shortcuts.assign(config.shortcut, commandId);
        this.registeredCommands.add(commandId);
      } catch (e) {
        this.logger.error(`Failed to assign shortcut ${config.shortcut}`, e);
      }
    }
  }

  protected settingsComponent = ShortcutsSettings;
}

function ShortcutsSettings({ plugin }: { plugin: TagShortcutsPlugin }) {
  const settings = plugin["getSettings"]();
  const [tags, setTags] = useState<TagShortcutConfig[]>(
    settings.tags || [{ tag: "碎碎念", shortcut: "ctrl+shift+t" }],
  );

  const handleSave = async (newTags: TagShortcutConfig[]) => {
    setTags(newTags);
    await plugin["updateSettings"]({ tags: newTags });
    orca.notify(
      "success",
      t("Settings saved. Please reload sub-plugin to take effect."),
    );
  };

  const addTag = () => {
    handleSave([...tags, { tag: "", shortcut: "" }]);
  };

  const removeTag = (index: number) => {
    const newTags = [...tags];
    newTags.splice(index, 1);
    handleSave(newTags);
  };

  const updateTag = (
    index: number,
    field: keyof TagShortcutConfig,
    value: string,
  ) => {
    const newTags = [...tags];
    newTags[index] = { ...newTags[index], [field]: value };
    handleSave(newTags);
  };

  const Button = orca.components.Button;
  const Input = orca.components.Input;

  return (
    <SettingsSection title={t("Tag Shortcuts")}>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {tags.map((config, index) => (
          <div
            key={index}
            style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}
          >
            <div style={{ flex: 1 }}>
              <div
                style={{ fontSize: "0.8em", marginBottom: "4px", opacity: 0.6 }}
              >
                {t("Tag(s)")}
              </div>
              <Input
                // @ts-ignore
                value={config.tag}
                onChange={(e: any) => updateTag(index, "tag", e.target.value)}
                placeholder="e.g. tag1, tag2"
              />
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{ fontSize: "0.8em", marginBottom: "4px", opacity: 0.6 }}
              >
                {t("Shortcut")}
              </div>
              <Input
                // @ts-ignore
                value={config.shortcut}
                onChange={(e: any) =>
                  updateTag(index, "shortcut", e.target.value)
                }
                placeholder="e.g. Alt+t"
              />
            </div>
            <Button
              variant="dangerous"
              onClick={() => removeTag(index)}
              style={{ padding: "8px", minWidth: "auto" }}
            >
              <i className="ti ti-trash"></i>
            </Button>
          </div>
        ))}
        <Button variant="soft" onClick={addTag} style={{ marginTop: "8px" }}>
          <i className="ti ti-plus" style={{ marginRight: "4px" }}></i>
          {t("Add Shortcut")}
        </Button>
      </div>
      <p style={{ marginTop: "20px", fontSize: "0.9em", opacity: 0.6 }}>
        {t(
          "Tip: Separate multiple tags with commas. Shortcut format examples: 'ctrl+shift+t', 'Alt+i'.",
        )}
      </p>
    </SettingsSection>
  );
}
