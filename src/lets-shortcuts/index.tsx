import React, { useState } from "react";
import { BasePlugin } from "@/libs/BasePlugin";
import { t } from "@/libs/l10n";
import { SettingsItem, SettingsSection } from "@/components/SettingsItem";

import { PropType } from "@/libs/consts";

interface PropertyDefault {
  name: string;
  value: string;
  type: number; // PropType
  typeArgs?: any;
}

interface TagShortcutConfig {
  tag: string;
  shortcut: string;
  defaults?: PropertyDefault[];
}

import { DataImporter, BlockData, TagData } from "@/libs/DataImporter";

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
    this.logger.debug("Settings loaded", settings);
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

          const tagNames = config.tag
            .split(",")
            .map((t) => t.trim())
            .filter((t) => t.length > 0);

          for (const tag of tagNames) {
            await DataImporter.importBlock(
              {
                tags: [
                  {
                    name: tag,
                    properties: config.defaults || [],
                  },
                ],
              },
              {
                type: "cursor",
                cursor,
              },
            );
          }

          return null;
        },
        () => {},
        { label: `插入标签: ${config.tag}` },
      );
      this.registeredCommands.add(commandId);
      try {
        await orca.shortcuts.assign(config.shortcut, commandId);
      } catch (e) {
        this.logger.error(`Failed to assign shortcut ${config.shortcut}`, e);
      }
    }
  }

  protected settingsComponent = ShortcutsSettings;

  protected async onConfigChanged(_newConfig: any): Promise<void> {
    if (this.isLoaded) {
      await this.reloadShortcuts();
    }
  }
}

function ShortcutsSettings({ plugin }: { plugin: TagShortcutsPlugin }) {
  const settings = plugin["getSettings"]();
  const [tags, setTags] = useState<TagShortcutConfig[]>(
    settings.tags || [{ tag: "碎碎念", shortcut: "ctrl+shift+t" }],
  );

  const handleSave = async (
    newTags: TagShortcutConfig[],
  ) => {
    setTags(newTags);
    await plugin["updateSettings"]({
      tags: newTags,
    });
  };

  const addTag = () => {
    handleSave([...tags, { tag: "", shortcut: "" }]);
  };

  const removeTag = (index: number) => {
    const newTags = [...tags];
    newTags.splice(index, 1);
    handleSave(newTags);
  };

  const updateTagConfig = (index: number, newConfig: TagShortcutConfig) => {
    const newTags = [...tags];
    newTags[index] = newConfig;
    handleSave(newTags);
  };

  const Button = orca.components.Button;
  const Input = orca.components.Input;

  return (
    <SettingsSection title={t("Tag Shortcuts")}>
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {tags.map((config, index) => (
          <TagShortcutItem
            key={index}
            config={config}
            onChange={(newConfig) => updateTagConfig(index, newConfig)}
            onDelete={() => removeTag(index)}
          />
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

function TagShortcutItem({
  config,
  onChange,
  onDelete,
}: {
  config: TagShortcutConfig;
  onChange: (cfg: TagShortcutConfig) => void;
  onDelete: () => void;
}) {
  const Button = orca.components.Button;
  const Input = orca.components.Input;

  const updateField = (field: keyof TagShortcutConfig, value: any) => {
    onChange({ ...config, [field]: value });
  };

  const addDefault = () => {
    const defaults = config.defaults || [];
    updateField("defaults", [
      ...defaults,
      { name: "", value: "", type: PropType.Text },
    ]);
  };

  const updateDefault = (
    index: number,
    field: keyof PropertyDefault,
    value: any,
  ) => {
    const defaults = [...(config.defaults || [])];
    defaults[index] = { ...defaults[index], [field]: value };
    updateField("defaults", defaults);
  };

  const removeDefault = (index: number) => {
    const defaults = [...(config.defaults || [])];
    defaults.splice(index, 1);
    updateField("defaults", defaults);
  };

  const TYPE_OPTIONS = [
    { label: t("Text"), value: PropType.Text },
    { label: t("Number"), value: PropType.Number },
    { label: t("Select/Multi"), value: PropType.TextChoices },
    { label: t("DateTime"), value: PropType.DateTime },
    { label: t("Checkbox"), value: PropType.Boolean },
  ];

  return (
    <div
      style={{
        border: "1px solid var(--orca-color-border)",
        padding: "12px",
        borderRadius: "8px",
        backgroundColor: "var(--orca-color-bg-2)",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: "12px",
          alignItems: "flex-end",
          marginBottom: "12px",
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "0.8em", marginBottom: "4px", opacity: 0.6 }}>
            {t("Tag(s)")}
          </div>
          <Input
            value={config.tag}
            onChange={(e: any) => updateField("tag", e.target.value)}
            placeholder={t("e.g. tag1, tag2")}
          />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "0.8em", marginBottom: "4px", opacity: 0.6 }}>
            {t("Shortcut")}
          </div>
          <Input
            value={config.shortcut}
            onChange={(e: any) => updateField("shortcut", e.target.value)}
            placeholder={t("e.g. Alt+t")}
          />
        </div>
        <Button
          variant="dangerous"
          onClick={onDelete}
          style={{ padding: "8px", minWidth: "auto" }}
        >
          <i className="ti ti-trash"></i>
        </Button>
      </div>

      <div
        style={{
          paddingLeft: "12px",
          borderLeft: "2px solid var(--orca-color-border)",
        }}
      >
        <div
          style={{
            fontSize: "0.85em",
            fontWeight: "bold",
            marginBottom: "8px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{t("Default Properties")}</span>
          <Button
            variant="outline"
            onClick={addDefault}
            style={{ fontSize: "0.8em", padding: "2px 8px", minHeight: "24px" }}
          >
            <i className="ti ti-plus"></i> {t("Add Property")}
          </Button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {(config.defaults || []).map((def, idx) => (
            <div
              key={idx}
              style={{ display: "flex", gap: "8px", alignItems: "center" }}
            >
              <Input
                value={def.name}
                onChange={(e: any) =>
                  updateDefault(idx, "name", e.target.value)
                }
                placeholder={t("Property Name")}
                style={{ flex: 1 }}
              />
              <div style={{ position: "relative" }}>
                <select
                  value={def.type}
                  onChange={(e) =>
                    updateDefault(idx, "type", parseInt(e.target.value))
                  }
                  style={{
                    appearance: "none",
                    background: "var(--orca-color-bg-1)",
                    border: "1px solid var(--orca-color-border)",
                    color: "var(--orca-color-text)",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    height: "32px",
                  }}
                >
                  {TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                value={def.value}
                onChange={(e: any) =>
                  updateDefault(idx, "value", e.target.value)
                }
                placeholder={t("Value (comma for multi)")}
                style={{ flex: 2 }}
              />
              <Button
                variant="plain"
                onClick={() => removeDefault(idx)}
                style={{ minWidth: "24px", padding: "4px" }}
              >
                <i className="ti ti-x"></i>
              </Button>
            </div>
          ))}
          {(!config.defaults || config.defaults.length === 0) && (
            <div
              style={{ fontSize: "0.8em", opacity: 0.5, fontStyle: "italic" }}
            >
              {t("No default properties configured.")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
