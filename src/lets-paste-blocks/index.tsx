import React, { useState } from "react";
import { BasePlugin } from "@/libs/BasePlugin";
import { t } from "@/libs/l10n";
import { SettingsSection } from "@/components/SettingsItem";
import { DataImporter, BlockData } from "@/libs/DataImporter";

export default class PasteBlocksPlugin extends BasePlugin {
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
          let json: any;
          try {
            json = JSON.parse(text);
          } catch (e) {
            orca.notify("error", t("Invalid JSON in clipboard"));
            return null;
          }

          if (json.type !== "orca-tags") {
            orca.notify(
              "error",
              t("Clipboard content does not match expected format"),
            );
            return null;
          }

          const tags = Array.isArray(json.tags) ? json.tags : [];
          if (tags.length === 0 && !json.content) {
            orca.notify("error", t("Clipboard content is empty"));
            return null;
          }

          // Deduplication Check
          const primaryKeyConfig = json.primaryKey;
          if (primaryKeyConfig) {
            outerLoop: for (const item of tags) {
              for (const [tagName, props] of Object.entries(item)) {
                if (Array.isArray(props)) {
                  let targetPropertyName: string | undefined;

                  if (typeof primaryKeyConfig === "string") {
                    targetPropertyName = primaryKeyConfig;
                  } else if (
                    typeof primaryKeyConfig === "object" &&
                    primaryKeyConfig !== null
                  ) {
                    targetPropertyName = primaryKeyConfig[tagName];
                  }

                  if (targetPropertyName) {
                    const prop = props.find(
                      (p: any) => p.name === targetPropertyName,
                    );
                    if (prop) {
                      const targetValue = prop.value;
                      try {
                        const resultIds = await orca.invokeBackend("query", {
                          q: {
                            kind: 100, // QueryKindSelfAnd
                            conditions: [
                              {
                                kind: 4, // QueryKindTag
                                name: tagName,
                                properties: [
                                  {
                                    name: targetPropertyName,
                                    op: 1, // QueryOp.Equal
                                    value: targetValue,
                                  },
                                ],
                                selfOnly: true,
                              },
                            ],
                          },
                          pageSize: 1,
                        });

                        if (Array.isArray(resultIds) && resultIds.length > 0) {
                          orca.notify(
                            "warn",
                            t(
                              "Skipped duplicate block (Key: ${key}, Value: ${value})",
                              {
                                key: targetPropertyName,
                                value: targetValue,
                              },
                            ),
                          );
                          return null; // Stop execution
                        }
                      } catch (err) {
                        this.logger.error("Deduplication query failed", err);
                      }
                    }
                  }
                }
              }
            }
          }

          // Handle Image Download
          if (json.downloadImages === true) {
            orca.notify("info", t("Downloading images..."));
            for (const item of tags) {
              for (const [tagName, props] of Object.entries(item)) {
                if (Array.isArray(props)) {
                  for (const prop of props) {
                    if (
                      prop.typeArgs?.subType === "image" &&
                      typeof prop.value === "string" &&
                      prop.value.startsWith("http")
                    ) {
                      try {
                        this.logger.info(
                          `Downloading cover image: ${prop.value}`,
                        );
                        // Using fetch directly as we are in a browser environment context (plugin)
                        const response = await fetch(prop.value);
                        if (response.ok) {
                          const arrayBuffer = await response.arrayBuffer();
                          const contentType =
                            response.headers.get("content-type") || "image/png";

                          const assetPath = await orca.invokeBackend(
                            "upload-asset-binary",
                            contentType,
                            arrayBuffer,
                          );

                          if (assetPath) {
                            this.logger.info(
                              `Cover downloaded to: ${assetPath}`,
                            );
                            prop.value = assetPath;
                          }
                        }
                      } catch (e) {
                        this.logger.error("Error downloading cover image", e);
                      }
                    }
                  }
                }
              }
            }
          }

          // Convert to BlockData
          const blockData: BlockData = {
            content: json.content,
            tags: tags.flatMap((item: any) =>
              Object.entries(item).map(([tagName, props]) => ({
                name: tagName,
                properties: props as any[],
              })),
            ),
          };

          await DataImporter.importBlock(blockData, {
            type: "cursor",
            cursor,
          });
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
  }

  protected settingsComponent = PasteBlocksSettings;

  protected async onConfigChanged(_newConfig: any): Promise<void> {
    if (this.isLoaded) {
      await this.reloadShortcuts();
    }
  }
}

function PasteBlocksSettings({ plugin }: { plugin: PasteBlocksPlugin }) {
  const settings = plugin["getSettings"]();
  const [pasteShortcut, setPasteShortcut] = useState<string>(
    settings.pasteTagsShortcut || "",
  );
  const [showHelper, setShowHelper] = useState(false);

  const handleSave = async (newPasteShortcut: string) => {
    setPasteShortcut(newPasteShortcut);
    await plugin["updateSettings"]({
      pasteTagsShortcut: newPasteShortcut,
    });
  };

  const Button = orca.components.Button;
  const Input = orca.components.Input;

  return (
    <SettingsSection title={t("Paste Blocks from JSON")}>
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
  "content": [
    { "t": "t", "v": "Check our " },
    { "t": "l", "v": "Orca Documentation", "l": "https://orca.so/docs" }
  ],
  "primaryKey": {
    "任务标签": "参考链接"
  },
  "downloadImages": true,
  "tags": [
    {
      "任务标签": [
        {
          "name": "状态",
          "type": 6,
          "value": ["进行中", "高优先级"]
        },
        {
          "name": "进度",
          "type": 3,
          "value": 75
        },
        {
          "name": "已归档",
          "type": 4,
          "value": false
        },
        {
          "name": "参考链接",
          "type": 1,
          "value": "https://leay.net",
          "typeArgs": { "subType": "link" }
        },
        {
          "name": "封面",
          "type": 1,
          "value": "https://raw.githubusercontent.com/hqweay/picbed/master/img/avatar/avatar.png",
          "typeArgs": { "subType": "image" }
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
            onChange={(e: any) => handleSave(e.target.value)}
            placeholder={t("e.g. ctrl+shift+v")}
            style={{ flex: 1 }}
          />
        </div>
      </div>
    </SettingsSection>
  );
}
