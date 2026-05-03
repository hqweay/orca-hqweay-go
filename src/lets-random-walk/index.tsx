import { BasePlugin } from "@/libs/BasePlugin";
import { t } from "@/libs/l10n";
import { SettingsItem, SettingsSection } from "@/components/SettingsItem";
import React, { useState, useEffect } from "react";
import type { DbId, QueryDescription2 } from "../../orca.d.ts";

export default class RandomWalkPlugin extends BasePlugin {
  protected settingsComponent = RandomWalkSettings;

  private queryStates = new Map<number, { seed: number; page: number }>();
  private normalStates = new Map<
    number,
    { indices: number[]; currentIndex: number }
  >();
  private lastWalkedGroupId: number | null = null;

  public getDefaultSettings(): any {
    return {
      walkTag: "随机漫步",
    };
  }

  public async load(): Promise<void> {
    orca.headbar.registerHeadbarButton("lets-random-walk.action", () => {
      return <RandomWalkHeadbarButton plugin={this} />;
    });
    this.logger.debug(`${this.name} loaded.`);
  }

  public async unload(): Promise<void> {
    orca.headbar.unregisterHeadbarButton("lets-random-walk.action");
    this.queryStates.clear();
    this.normalStates.clear();
    this.lastWalkedGroupId = null;
    this.logger.debug(`${this.name} unloaded.`);
  }

  public getWalkTag(): string {
    const settings = this.getSettings();
    return settings.walkTag || "随机漫步";
  }

  public async fetchGroups() {
    const tag = this.getWalkTag();
    const query: QueryDescription2 = {
      q: {
        kind: 4, // QueryKindTag
        name: tag,
      },
      page: 1,
      pageSize: 500,
    };
    try {
      const ids = (await orca.invokeBackend("query", query)) as DbId[];
      if (!ids || ids.length === 0) return [];

      const groups = [];
      for (const id of ids) {
        let block = orca.state.blocks[id];
        if (!block) {
          block = await orca.invokeBackend("get-block", id);
        }
        if (block) {
          groups.push(block);
        }
      }
      return groups;
    } catch (e) {
      this.logger.error("Failed to fetch groups", e);
      return [];
    }
  }

  public async walkGroup(groupId: number) {
    this.lastWalkedGroupId = groupId;

    let block = orca.state.blocks[groupId];
    if (!block) {
      block = await orca.invokeBackend("get-block", groupId);
    }
    if (!block) {
      orca.notify("warn", t("Group block not found."));
      return;
    }

    const repr = block.properties?.find((p: any) => p.name === "_repr")?.value;

    if (repr?.type === "query") {
      // It's a query block
      let state = this.queryStates.get(groupId);
      if (!state) {
        state = { seed: Date.now(), page: 1 };
        this.queryStates.set(groupId, state);
      }

      try {
        const queryDesc: QueryDescription2 = {
          q: JSON.parse(JSON.stringify(repr.q.q)),
          page: state.page,
          pageSize: 1,
          sort: [["_random", "DESC"]],
          randomSeed: state.seed,
        };

        const resultIds = (await orca.invokeBackend(
          "query",
          queryDesc,
        )) as DbId[];

        if (resultIds && resultIds.length > 0) {
          const nextId = resultIds[0];
          state.page += 1;
          orca.nav.goTo("block", { blockId: nextId });
        } else {
          // Empty result means we exhausted the pool. Reseed and restart.
          state.seed = Date.now();
          state.page = 1;
          orca.notify("info", t("Reshuffled query items."));

          // Retry immediately with new seed
          const retryQueryDesc: QueryDescription2 = {
            q: JSON.parse(JSON.stringify(repr.q.q)),
            page: state.page,
            pageSize: 1,
            sort: [["_random", "DESC"]],
            randomSeed: state.seed,
          };
          const retryResult = (await orca.invokeBackend(
            "query",
            retryQueryDesc,
          )) as DbId[];
          if (retryResult && retryResult.length > 0) {
            const nextId = retryResult[0];
            state.page += 1;
            orca.nav.goTo("block", { blockId: nextId });
          } else {
            orca.notify("warn", t("No items found in this query group."));
          }
        }
      } catch (err) {
        this.logger.error("Failed to execute query walk", err);
      }
    } else {
      // It's a normal block, walk its children
      const children = block.children;
      if (!children || children.length === 0) {
        orca.notify("warn", t("No children in this block group."));
        return;
      }

      let state = this.normalStates.get(groupId);
      if (!state || state.indices.length !== children.length) {
        // Initialize or re-initialize if length changed
        const indices = Array.from({ length: children.length }, (_, i) => i);
        indices.sort(() => Math.random() - 0.5);
        state = { indices, currentIndex: 0 };
        this.normalStates.set(groupId, state);
      }

      const nextId = children[state.indices[state.currentIndex]];
      state.currentIndex += 1;

      if (state.currentIndex >= state.indices.length) {
        orca.notify("info", t("Reshuffled items."));
        state.indices.sort(() => Math.random() - 0.5);
        state.currentIndex = 0;
      }

      orca.nav.goTo("block", { blockId: nextId });
    }
  }

  public async walkLastOrFirst() {
    const groups = await this.fetchGroups();
    if (groups.length === 0) {
      orca.notify(
        "warn",
        t("No random walk groups found. Add tag ") + `#${this.getWalkTag()}`,
      );
      return;
    }

    if (this.lastWalkedGroupId != null) {
      const exists = groups.some((g: any) => g.id === this.lastWalkedGroupId);
      if (exists) {
        await this.walkGroup(this.lastWalkedGroupId);
        return;
      }
    }

    // Default to the first group
    await this.walkGroup(groups[0].id);
  }
}

function MenuContent({
  plugin,
  closeMenu,
}: {
  plugin: RandomWalkPlugin;
  closeMenu: () => void;
}) {
  const [groups, setGroups] = useState<any[]>([]);

  useEffect(() => {
    plugin.fetchGroups().then(setGroups);
  }, [plugin]);

  const getGroupTitle = (block: any) => {
    const repr = block.properties?.find((p: any) => p.name === "_repr")?.value;
    if (repr?.type === "query") {
      if (repr.cap) {
        return repr.cap;
      }
      return t("Query Group");
    }

    if (block.text) {
      let text = block.text.substring(0, 5);
      if (block.text.length > 5) text += "...";
      return text;
    }
    return t("Unnamed Group");
  };

  if (groups.length === 0) {
    return (
      <React.Fragment>
        <orca.components.MenuText
          title={t("No groups found")}
          onClick={closeMenu}
        />
      </React.Fragment>
    );
  }

  return (
    <React.Fragment>
      {groups.map((g: any) => (
        <orca.components.MenuText
          key={g.id}
          title={getGroupTitle(g)}
          preIcon="ti ti-hash"
          onClick={() => {
            closeMenu();
            plugin.walkGroup(g.id);
          }}
        />
      ))}
    </React.Fragment>
  );
}

function RandomWalkHeadbarButton({ plugin }: { plugin: RandomWalkPlugin }) {
  return (
    <orca.components.HoverContextMenu
      alignment="center"
      defaultPlacement="bottom"
      menu={(closeMenu: () => void) => (
        <MenuContent plugin={plugin} closeMenu={closeMenu} />
      )}
    >
      <orca.components.Button
        variant="plain"
        onClick={() => plugin.walkLastOrFirst()}
        title={t("Random Walk")}
      >
        <i className="ti ti-dice-5" style={{ fontSize: "16px" }} />
      </orca.components.Button>
    </orca.components.HoverContextMenu>
  );
}

function RandomWalkSettings({ plugin }: { plugin: RandomWalkPlugin }) {
  const settings = plugin["getSettings"]();
  const [config, setConfig] = useState(settings);

  const updateConfig = async (path: string, value: any) => {
    const newConfig = { ...config, [path]: value };
    setConfig(newConfig);
    await plugin["updateSettings"](newConfig);
  };

  const Input = orca.components.Input;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
      <SettingsSection title={t("Random Walk Settings")}>
        <SettingsItem
          label={t("Walk Tag")}
          description={t(
            "Blocks with this tag will be recognized as random walk groups.",
          )}
        >
          <Input
            value={config.walkTag || "随机漫步"}
            onChange={(e: any) => updateConfig("walkTag", e.target.value)}
          />
        </SettingsItem>
      </SettingsSection>
    </div>
  );
}
