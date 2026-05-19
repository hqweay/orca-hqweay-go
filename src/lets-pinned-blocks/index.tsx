import { BasePlugin } from "@/libs/BasePlugin";
import { t } from "@/libs/l10n";
import { SettingsItem, SettingsSection } from "@/components/SettingsItem";
import React, { useState, useEffect } from "react";
import type { Block } from "../orca.d.ts";

export default class PinnedBlocksPlugin extends BasePlugin {
  protected settingsComponent = PinnedBlocksSettings;

  /** 上次打开的块 ID（插件实例级别，重载前保留） */
  public lastOpenedBlockId: number | null = null;

  public getDefaultSettings(): any {
    return {
      pinTag: "置顶",
    };
  }

  public getPinTag(): string {
    const settings = this.getSettings();
    return settings.pinTag || "置顶";
  }

  public async fetchPinnedBlocks(): Promise<Block[]> {
    const tag = this.getPinTag();
    try {
      const blocks = (await orca.invokeBackend("get-blocks-with-tags", [
        tag,
      ])) as Block[];
      return blocks ?? [];
    } catch (e) {
      this.logger.error("Failed to fetch pinned blocks", e);
      return [];
    }
  }

  /**
   * 读取块的显示名称。
   * 优先取标签属性 displayName，再取块文本，最后取别名。
   * 参考 random-walk 的 getGroupTitle 实现。
   */
  public getBlockDisplayName(block: Block): string {
    const pinTag = this.getPinTag();

    // 1. 优先从标签属性 displayName 获取
    const tagRef = (block.refs as any[])?.find(
      (r: any) => r.type === 2 && (r.alias === pinTag || r.name === pinTag),
    );
    const displayName =
      tagRef?.data?.find((p: any) => p.name === "displayName")?.value ||
      (block.properties as any[])?.find((p: any) => p.name === "displayName")
        ?.value;
    if (displayName) return displayName;

    // 2. 从块文本截断
    if (block.text && block.text.trim()) {
      const text = block.text.trim();
      return text.length > 30 ? text.substring(0, 30) + "…" : text;
    }

    // 3. 从 aliases 获取
    if (block.aliases && block.aliases.length > 0) return block.aliases[0];

    return t("Unnamed Block");
  }

  public openBlockInSide(blockId: number, panelId: string) {
    this.lastOpenedBlockId = blockId;
    const newPanelId = orca.nav.addTo(panelId, "right", {
      view: "block",
      viewArgs: { blockId },
      viewState: {},
    });
    if (newPanelId) orca.nav.switchFocusTo(newPanelId);
  }

  public async load(): Promise<void> {
    orca.editorSidetools.registerEditorSidetool("lets-pinned-blocks.sidetool", {
      render: (_rootBlockId, panelId) => (
        <PinnedBlocksSidetool plugin={this} panelId={panelId} />
      ),
    });
    this.logger.debug(`${this.name} loaded.`);
  }

  public async unload(): Promise<void> {
    orca.editorSidetools.unregisterEditorSidetool(
      "lets-pinned-blocks.sidetool",
    );
    this.lastOpenedBlockId = null;
    this.logger.debug(`${this.name} unloaded.`);
  }
}

// ─── 侧边工具按钮组件 ─────────────────────────────────────────────────────────

function PinnedBlocksSidetool({
  plugin,
  panelId,
}: {
  plugin: PinnedBlocksPlugin;
  panelId: string;
}) {
  /** 左键：打开上次的块，没有则弹菜单 */
  const handleClick = async (
    e: React.MouseEvent,
    openMenu: (e: React.UIEvent) => void,
  ) => {
    const lastId = plugin.lastOpenedBlockId;
    if (lastId !== null) {
      let block: Block | null = orca.state.blocks[lastId] ?? null;
      if (!block) {
        block = (await orca.invokeBackend("get-block", lastId)) as Block | null;
      }
      if (block) {
        plugin.openBlockInSide(lastId, panelId);
        return;
      }
      plugin.lastOpenedBlockId = null;
    }
    // 没有上次记录，打开选择菜单
    openMenu(e);
  };

  const hasLast = plugin.lastOpenedBlockId !== null;

  return (
    <orca.components.ContextMenu
      placement="horizontal"
      defaultPlacement="left"
      alignment="top"
      menu={(closeMenu) => (
        <PinnedMenuContent
          plugin={plugin}
          panelId={panelId}
          closeMenu={closeMenu}
        />
      )}
    >
      {(openMenu) => (
        <orca.components.Button
          variant="plain"
          style={{
            width: "30px",
            height: "30px",
            padding: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: hasLast ? "var(--orca-color-primary-5)" : undefined,
          }}
          title={
            hasLast
              ? t("Pinned Blocks (Click to reopen last, Right-click for list)")
              : t("Pinned Blocks (Right-click for list)")
          }
          onClick={(e: any) => handleClick(e, openMenu)}
          onContextMenu={(e: any) => {
            e.preventDefault();
            openMenu(e);
          }}
        >
          <i className="ti ti-pin" style={{ fontSize: "16px" }} />
        </orca.components.Button>
      )}
    </orca.components.ContextMenu>
  );
}

// ─── 菜单内容组件（在 ContextMenu 弹出后挂载，自行加载数据） ──────────────────

function PinnedMenuContent({
  plugin,
  panelId,
  closeMenu,
}: {
  plugin: PinnedBlocksPlugin;
  panelId: string;
  closeMenu: () => void;
}) {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    plugin
      .fetchPinnedBlocks()
      .then(setBlocks)
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <React.Fragment>
        <orca.components.MenuText title={t("Loading...")} />
      </React.Fragment>
    );
  }

  if (blocks.length === 0) {
    return (
      <React.Fragment>
        <orca.components.MenuText
          title={`${t("No pinned blocks found. Add tag ")} #${plugin.getPinTag()}`}
        />
      </React.Fragment>
    );
  }

  return (
    <React.Fragment>
      {blocks.map((block) => {
        const isLast = block.id === plugin.lastOpenedBlockId;
        return (
          <orca.components.MenuText
            key={block.id}
            title={plugin.getBlockDisplayName(block)}
            preIcon={isLast ? "ti ti-pin-filled" : "ti ti-layout-sidebar-right"}
            shortcut={isLast ? t("Last") : undefined}
            onClick={() => {
              closeMenu();
              plugin.openBlockInSide(block.id, panelId);
            }}
          />
        );
      })}
    </React.Fragment>
  );
}

// ─── 设置界面 ─────────────────────────────────────────────────────────────────

function PinnedBlocksSettings({ plugin }: { plugin: PinnedBlocksPlugin }) {
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
      <SettingsSection title={t("Pinned Blocks Settings")}>
        <div
          style={{
            fontSize: "0.9em",
            opacity: 0.8,
            marginBottom: "24px",
            lineHeight: "1.6",
          }}
        >
          {t(
            "Tag-based pinned blocks panel. Add the configured tag to any block to pin it. Hover the pin icon in the editor sidebar to see all pinned blocks. Left-click to reopen the last block; right-click to open the full list. You can set a 'displayName' property on the tag to customize the display name.",
          )}
        </div>
        <SettingsItem
          label={t("Pin Tag")}
          description={t(
            "Blocks with this tag will appear in the pinned blocks panel.",
          )}
        >
          <Input
            value={config.pinTag || "置顶"}
            onChange={(e: any) => updateConfig("pinTag", e.target.value)}
          />
        </SettingsItem>
      </SettingsSection>
    </div>
  );
}
