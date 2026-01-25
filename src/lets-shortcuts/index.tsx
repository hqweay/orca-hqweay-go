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

export default class TagShortcutsPlugin extends BasePlugin {
  private registeredCommands: Set<string> = new Set();

  public async load(): Promise<void> {
    await this.reloadShortcuts();
    this.logger.info(`${this.name} loaded.`);
  }

  private async registerStaticCommands() {
    const commandId = `${this.name}.paste-clipboard-tags`;
    orca.commands.registerEditorCommand(
      commandId,
      async ([_panelId, _rootBlockId, cursor]) => {
        if (!cursor || !cursor.anchor) {
          orca.notify("warn", t("Please place cursor in editor first."));
          return null;
        }

        try {
          const text = await navigator.clipboard.readText();
          let data: any[] = [];

          let json: any;
          try {
            json = JSON.parse(text);
          } catch (e) {
            orca.notify("error", t("Invalid JSON in clipboard"));
            return null;
          }

          // Validation Strategy
          // 1. Structured Envelope
          if (json.type === "orca-tags" && Array.isArray(json.data)) {
            data = json.data;
          }
          // 2. Heuristic Schema Match (Array of objects)
          else if (Array.isArray(json)) {
            const isValid = json.every(
              (item: any) => typeof item === "object" && item !== null,
            );
            if (isValid) {
              data = json;
            }
          }

          if (!data || data.length === 0) {
            orca.notify(
              "error",
              t("Clipboard content does not match expected format"),
            );
            return null;
          }

          if (json.text) {
            let fragments = [];
            if (typeof json.text === "string") {
              fragments = [{ t: "t", v: json.text }];
            } else if (Array.isArray(json.text)) {
              fragments = json.text;
            }

            if (fragments.length > 0) {
              await orca.commands.invokeEditorCommand(
                "core.editor.insertFragments",
                null,
                fragments,
              );
            }
          }

          const { anchor } = cursor;
          for (const item of data) {
            // item is { tagName: Property[] }
            for (const [tagName, properties] of Object.entries(item)) {
              if (!Array.isArray(properties)) {
                this.logger.warn(
                  `Skipping tag ${tagName}: properties is not an array`,
                );
                continue;
              }
              await this.insertTagWithProperties(
                anchor.blockId,
                tagName,
                properties as PropertyDefault[],
              );
            }
          }
        } catch (e) {
          this.logger.error("Failed to paste tags", e);
          orca.notify("error", t("Failed to paste tags from clipboard"));
        }
        return null;
      },
      () => {},
      { label: t("Paste Tags from Clipboard") },
    );

    this.registeredCommands.add(commandId);
    this.logger.debug(`Registered static command ${commandId}`);

    // Assign shortcut if configured
    const settings = this.getSettings();
    const shortcut = settings.pasteTagsShortcut;
    if (shortcut) {
      try {
        await orca.shortcuts.assign(shortcut, commandId);
        this.logger.debug(`Assigned shortcut ${shortcut} to ${commandId}`);
      } catch (e) {
        this.logger.error(`Failed to assign shortcut ${shortcut}`, e);
      }
    }
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

    // Register static commands every reload to keep them active
    await this.registerStaticCommands();

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

          const { anchor } = cursor;
          const tagNames = config.tag
            .split(",")
            .map((t) => t.trim())
            .filter((t) => t.length > 0);

          for (const tag of tagNames) {
            await this.insertTagWithProperties(
              anchor.blockId,
              tag,
              config.defaults,
            );
          }

          return null;
        },
        () => {},
        { label: `插入标签: ${config.tag}` },
      );
      this.logger.debug(`Registered command ${commandId}`);
      this.logger.debug(`Assigning shortcut ${config.shortcut}`);

      try {
        await orca.shortcuts.assign(config.shortcut, commandId);
        this.registeredCommands.add(commandId);
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

  private async insertTagWithProperties(
    blockId: number,
    tagName: string,
    properties: PropertyDefault[] = [],
  ) {
    if (!properties || properties.length === 0) {
      // Simple insert if no defaults
      await orca.commands.invokeEditorCommand(
        "core.editor.insertTag",
        null,
        blockId,
        tagName,
      );
      return;
    }

    const formattedProperties = properties.map((p) => {
      if (p.type === PropType.TextChoices) {
        // Handle select/multi-select
        let values: string[] = [];
        if (Array.isArray(p.value)) {
          values = p.value;
        } else if (typeof p.value === "string") {
          values = p.value
            .split(",")
            .map((v) => v.trim())
            .filter((v) => v);
        }

        // For formatted properties passed to insertTag, value should be the selected values
        return {
          name: p.name,
          type: p.type,
          value: values, // Pass as array for multi-select
          // For TextChoices, Orca usually expects an array of choices in typeArgs
          // AND the value field to be the selected value(s).
          typeArgs: {
            choices: values.map((v) => ({ n: v, c: "" })), // Add these as valid choices
            subType: "multi",
          },
          pos: 0,
        };
      }
      return {
        name: p.name,
        value: p.value,
        type: p.type,
        typeArgs: p.typeArgs,
      };
    });

    // 1. Insert Tag with properties
    const tagBlockId = await orca.commands.invokeEditorCommand(
      "core.editor.insertTag",
      null,
      blockId,
      tagName,
      formattedProperties,
    );

    // 2. Ensure Schema Exists/Updates on the Tag Block
    if (tagBlockId) {
      const tagBlock = await orca.invokeBackend("get-block", tagBlockId);
      if (tagBlock) {
        const existingProps = tagBlock.properties || [];
        const propsToAdd = [];

        for (const prop of formattedProperties) {
          const existingProp = existingProps.find(
            (p: any) => p.name === prop.name,
          );

          if (!existingProp) {
            // Case 1: Property does not exist -> Add it
            propsToAdd.push({
              name: prop.name,
              type: prop.type,
              typeArgs: prop.typeArgs,
            });
          } else if (
            prop.type === PropType.TextChoices &&
            existingProp.type === PropType.TextChoices
          ) {
            // Case 2: Property exists -> Merge choices
            const existingChoices = existingProp.typeArgs?.choices || [];
            const existingChoiceValues = new Set(
              existingChoices.map((c: any) => c.n),
            );

            const newChoices = prop.typeArgs?.choices || [];
            let hasNew = false;

            for (const choice of newChoices) {
              if (!existingChoiceValues.has(choice.n)) {
                existingChoices.push(choice);
                hasNew = true;
              }
            }

            if (hasNew) {
              propsToAdd.push({
                name: existingProp.name,
                type: existingProp.type,
                typeArgs: {
                  ...existingProp.typeArgs,
                  choices: existingChoices,
                },
              });
            }
          }
        }

        if (propsToAdd.length > 0) {
          this.logger.info("Updating tag schema", propsToAdd);
          await orca.commands.invokeEditorCommand(
            "core.editor.setProperties",
            null,
            [tagBlockId],
            propsToAdd,
          );
        }
      }
    }
  }
}

function ShortcutsSettings({ plugin }: { plugin: TagShortcutsPlugin }) {
  const settings = plugin["getSettings"]();
  const [tags, setTags] = useState<TagShortcutConfig[]>(
    settings.tags || [{ tag: "碎碎念", shortcut: "ctrl+shift+t" }],
  );
  const [pasteShortcut, setPasteShortcut] = useState<string>(
    settings.pasteTagsShortcut || "",
  );

  const handleSave = async (
    newTags: TagShortcutConfig[],
    newPasteShortcut: string,
  ) => {
    setTags(newTags);
    setPasteShortcut(newPasteShortcut);
    await plugin["updateSettings"]({
      tags: newTags,
      pasteTagsShortcut: newPasteShortcut,
    });
  };

  const addTag = () => {
    handleSave([...tags, { tag: "", shortcut: "" }], pasteShortcut);
  };

  const removeTag = (index: number) => {
    const newTags = [...tags];
    newTags.splice(index, 1);
    handleSave(newTags, pasteShortcut);
  };

  const updateTagConfig = (index: number, newConfig: TagShortcutConfig) => {
    const newTags = [...tags];
    newTags[index] = newConfig;
    handleSave(newTags, pasteShortcut);
  };

  const updatePasteShortcut = (val: string) => {
    handleSave(tags, val);
  };

  const [showHelper, setShowHelper] = useState(false);

  const Button = orca.components.Button;
  const Input = orca.components.Input;

  return (
    <SettingsSection title={t("Tag Shortcuts")}>
      <div style={{ marginBottom: "24px" }}>
        <div style={{ fontSize: "0.9em", marginBottom: "8px", opacity: 0.8 }}>
          {t("Paste Tags Shortcut")}
          <div
            style={{ display: "inline-block", position: "relative" }}
            onMouseEnter={() => setShowHelper(true)}
            onMouseLeave={() => setShowHelper(false)}
          >
            <span
              style={{
                marginLeft: "6px",
                cursor: "pointer",
                opacity: 0.6,
                verticalAlign: "middle",
              }}
              onClick={(e) => {
                e.stopPropagation();
                // Copy example JSON to clipboard
                const exampleJson = `{
  "type": "orca-tags",
  "text": [
    { "t": "t", "v": "Check out " },
    { "t": "l", "v": "Orca Documentation", "l": "https://orca.so/docs" }
  ],
  "data": [
    {
      "测试标签": [
        {
          "name": "链接",
          "type": 1,
          "value": "https://leay.net",
          "typeArgs": { "subType": "link" }
        },
        {
          "name": "标题",
          "type": 1,
          "value": "Hello Orca"
        }
      ]
    }
  ]
}`;
                navigator.clipboard.writeText(exampleJson).then(() => {
                  orca.notify("success", t("Example JSON copied to clipboard"));
                });
              }}
            >
              <i className="ti ti-help" style={{ fontSize: "14px" }}></i>
            </span>
            {showHelper && (
              <div
                style={{
                  position: "absolute",
                  left: "20px",
                  top: "-10px",
                  backgroundColor: "var(--orca-color-bg-2)",
                  border: "1px solid var(--orca-color-border)",
                  borderRadius: "6px",
                  padding: "8px",
                  zIndex: 1000,
                  width: "300px",
                  fontSize: "0.9em",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                  whiteSpace: "pre-wrap",
                  color: "var(--orca-color-text)",
                }}
              >
                {t("pasteTagsHelper")}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <Input
            value={pasteShortcut}
            onChange={(e: any) => updatePasteShortcut(e.target.value)}
            placeholder={t("e.g. ctrl+shift+v")}
            style={{ flex: 1 }}
          />
        </div>
      </div>

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
            // @ts-ignore
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
            // @ts-ignore
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
                // @ts-ignore
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
                // @ts-ignore
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
