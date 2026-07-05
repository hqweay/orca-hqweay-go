import { BasePlugin } from "@/libs/BasePlugin";
import { setupL10N, t } from "@/libs/l10n";
import { Block, DbId } from "../orca";

import { SettingsItem, SettingsSection } from "@/components/SettingsItem";
import React, { useState } from "react";
import { getRepr } from "@/libs/BlockFormatter";
import { getBlocks, ensureBlockInState } from "@/libs/BlockCache";

export interface SortProfile {
  id: string;
  name: string;
  rules: string[];
}

const ALL_TYPES = [
  "task_unchecked",
  "task_checked",
  "heading",
  "query",
  "image",
  "table2",
  "epub",
  "mirror",
  "journal",
  "video",
  "audio",
  "empty",
  "text",
  "other",
];

export default class SortPlugin extends BasePlugin {
  protected settingsComponent = SortSettings;

  public getDefaultSettings(): any {
    return {
      profiles: [
        {
          id: "default",
          name: "Default",
          rules: ["empty", "other", "task_checked", "task_unchecked"],
        },
      ],
      headbarMode: "both",
    };
  }

  public async load(): Promise<void> {
    const settings = this.getSettings();
    if (typeof settings.order === "string") {
      const legacyRules = settings.order
        .split(/[,，]/)
        .map((s: string) => s.trim());
      settings.profiles = [
        {
          id: "default",
          name: "Default",
          rules: legacyRules,
        },
      ];
      delete settings.order;
      await this.updateSettings(settings);
    }

    // Register Block Menu Command
    if (orca.blockMenuCommands.registerBlockMenuCommand) {
      orca.blockMenuCommands.registerBlockMenuCommand(
        `${this.name}.sort-blocks`,
        {
          worksOnMultipleBlocks: true,
          render: (blockIds, rootBlockId, close) => {
            const MenuText = orca.components.MenuText;
            if (!MenuText) return null;
            if (!blockIds || blockIds.length <= 1) return null;

            const profiles: SortProfile[] =
              this.getSettings().profiles || [];

            if (profiles.length === 1) {
              return (
                <MenuText
                  preIcon="ti ti-sort-ascending-letters"
                  title={t("Sort Selected Blocks...")}
                  onClick={() => {
                    close();
                    orca.commands.invokeCommand(
                      `${this.name}.sort-selection`,
                      {
                        blockIds,
                        rootBlockId,
                        profileId: profiles[0].id,
                      },
                    );
                  }}
                />
              );
            } else if (profiles.length > 1) {
              return (
                <MenuText
                  preIcon="ti ti-sort-ascending-letters"
                  title={t("Sort Selected Blocks...")}
                  postIcon="ti ti-chevron-right"
                >
                  <orca.components.Menu>
                    {profiles.map((p) => (
                      <MenuText
                        key={p.id}
                        title={p.name}
                        onClick={() => {
                          close();
                          orca.commands.invokeCommand(
                            `${this.name}.sort-selection`,
                            { blockIds, rootBlockId, profileId: p.id },
                          );
                        }}
                      />
                    ))}
                  </orca.components.Menu>
                </MenuText>
              );
            }
            return null;
          },
        },
      );
    }

    // Register Editor Command
    orca.commands.registerCommand(
      `${this.name}.sort-selection`,
      async (args: {
        blockIds: number[];
        rootBlockId: number;
        profileId: string;
      }) => {
        const { blockIds, profileId } = args;
        if (!blockIds || blockIds.length <= 1) {
          orca.notify("info", t("Select at least 2 blocks to sort."));
          return;
        }

        const blocks = await getBlocks(blockIds);

        if (blocks.length !== blockIds.length) {
          orca.notify("error", t("Could not load all selected blocks."));
          return;
        }

        const parentId = blocks[0].parent;
        const allSiblings = blocks.every((b) => b.parent === parentId);
        if (!allSiblings || parentId === undefined) {
          orca.notify("warn", t("Blocks must be siblings to sort."));
          return;
        }

        // Get sort order from settings
        const settings = this.getSettings();
        const profiles: SortProfile[] = settings.profiles || [];
        const profile = profiles.find((p) => p.id === profileId) || profiles[0];
        const sortOrder = profile ? profile.rules : [];

        const sortedBlocks = [...blocks].sort((a: any, b: any) => {
          const getType = (blk: any): string => {
            const repr = getRepr(blk);
            const type = repr?.type || "text";

            if (type === "task") {
              const isChecked = repr.state === 1;
              return isChecked ? "task_checked" : "task_unchecked";
            }

            const text =
              typeof blk.text === "string"
                ? blk.text
                : blk.content?.[0]?.v || "";
            if (!text || text.trim() === "") {
              return "empty";
            }

            return type; // heading, query, image, table2, epub, mirror, journal, video, audio, text, other
          };

          const typeA = getType(a);
          const typeB = getType(b);

          let idxA = sortOrder.indexOf(typeA);
          let idxB = sortOrder.indexOf(typeB);

          // If type is not explicitly configured, fall back to "other" bucket if it exists
          if (idxA === -1 && sortOrder.includes("other")) {
            idxA = sortOrder.indexOf("other");
          }
          if (idxB === -1 && sortOrder.includes("other")) {
            idxB = sortOrder.indexOf("other");
          }

          // Use Infinity for completely unconfigured types to push them to end
          const valA = idxA === -1 ? 999 : idxA;
          const valB = idxB === -1 ? 999 : idxB;

          if (valA !== valB) {
            return valA - valB;
          }

          // Same type, tie-break with alphabetical text
          const getText = (blk: any) => {
            if (typeof blk.text === "string") return blk.text;
            return blk.content?.[0]?.v || "";
          };
          const textA = getText(a);
          const textB = getText(b);

          if (typeof textA === "string" && typeof textB === "string") {
            return textA.localeCompare(textB);
          }
          return 0;
        });

        let firstBlock = blocks.find((b) => !blockIds.includes(b.left || 0));

        let anchorBlockId = firstBlock?.left;

        const parentBlock = await ensureBlockInState(parentId!);

        let currentAnchor = anchorBlockId;

        for (let i = 0; i < sortedBlocks.length; i++) {
          const block = sortedBlocks[i];

          try {
            // Determine reference block
            let refBlockId = currentAnchor;
            let pos = "after";

            if (!refBlockId) {
              // Insert as first child of parent
              refBlockId = parentId;
              pos = "firstChild";
            }

            const refBlock = await ensureBlockInState(refBlockId!);

            await orca.commands.invokeEditorCommand(
              "core.editor.moveBlocks",
              null,
              [block.id], // Block IDs to move (array)
              refBlockId!, // Reference block ID
              pos, // Position
            );

            // Update anchor to be ANY block we just moved, so next one goes after it.
            currentAnchor = block.id;
          } catch (e) {
            console.warn("Move failed", e);
            // Fallback or ignore
          }
        }
        orca.notify("success", t("Blocks sorted."));
      },
      t("Sort Selection"),
    );
    this.logger.info(`${this.name} loaded.`);
  }

  public async unload(): Promise<void> {
    orca.blockMenuCommands.unregisterBlockMenuCommand(
      `${this.name}.sort-blocks`,
    );
    orca.commands.unregisterCommand(`${this.name}.sort-selection`);
    this.logger.info(`${this.name} unloaded.`);
  }
}

function SortSettings({ plugin }: { plugin: SortPlugin }) {
  const settings = plugin.getSettings();
  const [profiles, setProfiles] = useState<SortProfile[]>(
    settings.profiles || [],
  );

  const Button = orca.components.Button;
  const Input = orca.components.CompositionInput;

  const updateProfiles = async (newProfiles: SortProfile[]) => {
    setProfiles(newProfiles);
    await plugin["updateSettings"]({ profiles: newProfiles });
  };

  const handleAddProfile = () => {
    const newProfiles = [
      ...profiles,
      {
        id: Date.now().toString(),
        name: "New Profile",
        rules: ["task_unchecked", "task_checked", "empty", "other"],
      },
    ];
    updateProfiles(newProfiles);
  };

  const handleDeleteProfile = (id: string) => {
    updateProfiles(profiles.filter((p) => p.id !== id));
  };

  const handleUpdateName = (id: string, name: string) => {
    updateProfiles(
      profiles.map((p) => (p.id === id ? { ...p, name } : p)),
    );
  };

  const handleMoveRule = (profileId: string, idx: number, direction: -1 | 1) => {
    const newProfiles = profiles.map((p) => {
      if (p.id !== profileId) return p;
      const newRules = [...p.rules];
      const targetIdx = idx + direction;
      if (targetIdx >= 0 && targetIdx < newRules.length) {
        const temp = newRules[idx];
        newRules[idx] = newRules[targetIdx];
        newRules[targetIdx] = temp;
      }
      return { ...p, rules: newRules };
    });
    updateProfiles(newProfiles);
  };

  const handleDeleteRule = (profileId: string, ruleIdx: number) => {
    const newProfiles = profiles.map((p) => {
      if (p.id !== profileId) return p;
      const newRules = p.rules.filter((_, i) => i !== ruleIdx);
      return { ...p, rules: newRules };
    });
    updateProfiles(newProfiles);
  };

  const handleAddRule = (profileId: string, rule: string) => {
    if (!rule) return;
    const newProfiles = profiles.map((p) => {
      if (p.id !== profileId) return p;
      if (!p.rules.includes(rule)) {
        return { ...p, rules: [...p.rules, rule] };
      }
      return p;
    });
    updateProfiles(newProfiles);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <SettingsSection title={t("Sort Profiles")}>
        {profiles.map((profile) => {
          const availableTypes = ALL_TYPES.filter(
            (type) => !profile.rules.includes(type),
          );
          return (
            <div
              key={profile.id}
              style={{
                marginBottom: "16px",
                padding: "16px",
                border: "1px solid var(--orca-border-color, rgba(128,128,128,0.2))",
                borderRadius: "8px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  marginBottom: "16px",
                }}
              >
                <div style={{ flex: 1 }}>
                  <Input
                    // @ts-ignore
                    value={profile.name}
                    onChange={(e: any) =>
                      handleUpdateName(profile.id, e.target.value)
                    }
                    placeholder={t("Profile Name")}
                    style={{ width: "100%" }}
                  />
                </div>
                {profiles.length > 1 && (
                  <Button
                    variant="dangerous"
                    onClick={() => handleDeleteProfile(profile.id)}
                  >
                    <i className="ti ti-trash" /> {t("Delete Profile")}
                  </Button>
                )}
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  marginBottom: "16px",
                }}
              >
                {profile.rules.map((rule, idx) => (
                  <div
                    key={rule}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      background: "var(--orca-bg-2, rgba(128,128,128,0.05))",
                      borderRadius: "6px",
                    }}
                  >
                    <span>{t(`Type.${rule}`) || rule}</span>
                    <div style={{ display: "flex", gap: "4px" }}>
                      <Button
                        variant="plain"
                        // @ts-ignore
                        disabled={idx === 0}
                        onClick={() => handleMoveRule(profile.id, idx, -1)}
                      >
                        <i className="ti ti-chevron-up" />
                      </Button>
                      <Button
                        variant="plain"
                        // @ts-ignore
                        disabled={idx === profile.rules.length - 1}
                        onClick={() => handleMoveRule(profile.id, idx, 1)}
                      >
                        <i className="ti ti-chevron-down" />
                      </Button>
                      <Button
                        variant="plain"
                        style={{ color: "var(--orca-danger-color, red)" }}
                        onClick={() => handleDeleteRule(profile.id, idx)}
                      >
                        <i className="ti ti-trash" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <select
                  value=""
                  onChange={(e) => handleAddRule(profile.id, e.target.value)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "4px",
                    border: "1px solid var(--orca-border-color, rgba(128,128,128,0.2))",
                    background: "var(--orca-bg-1, transparent)",
                    color: "var(--orca-text-1, inherit)",
                  }}
                >
                  <option value="" disabled hidden>
                    {t("Add Rule")}
                  </option>
                  {availableTypes.length === 0 ? (
                    <option disabled>No more types available</option>
                  ) : (
                    availableTypes.map((type) => (
                      <option key={type} value={type}>
                        {t(`Type.${type}`) || type}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>
          );
        })}
        <Button variant="outline" onClick={handleAddProfile}>
          <i className="ti ti-plus" style={{ marginRight: "8px" }} />{" "}
          {t("Add Profile")}
        </Button>
      </SettingsSection>
    </div>
  );
}
