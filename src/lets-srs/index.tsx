import { DbId, PanelProps, QueryDescription2 } from "@/orca";
import { BasePlugin } from "../libs/BasePlugin";
import { setupL10N, t } from "../libs/l10n";
import {
  ensureCardTagSchema,
  getOrCreateTagBlock,
  setCardTagAlias,
} from "./core/tagSchema";
import { ReviewPanel } from "./ui/review-panel";
import applyCSSRule, { removeCSSRule } from "@/libs/styleUtil";
import React, { useEffect, useState } from "react";
import { SettingsItem, SettingsSection } from "@/components/SettingsItem";
import cloneDeep from "lodash.clonedeep";

/**
 * 虎鲸笔记 - 记忆卡片 (SRS) 插件
 *
 * 核心功能：
 * 1. 自动注册 #Card 标签 Schema（属性：Due, Type, fsrsData）
 * 2. 侧边栏原生的复习看板 (Review Panel)
 * 3. 基于 ts-fsrs 算法的进度调度
 */

const RENDERER_TYPE = "lets-srs.review-session";
const COMMAND_OPEN = "lets-srs.openReview";
const STORAGE_KEY_SESSION_BLOCK = "reviewSessionBlockId";

export default class SrsPlugin extends BasePlugin {
  protected headbarButtonId = `${this.name}.srs`;
  private sessionBlockId: number | null = null;
  constructor(pluginName: string, subPluginName: string) {
    super(pluginName, subPluginName);
  }

  async load() {
    console.log(`[${this.name}] plugin loaded`);
    const settings = this.getSettings();
    if (settings.cardTag) {
      setCardTagAlias(settings.cardTag);
    }

    // orca.themes.injectCSSResource("./ui/srs.css", this.name);

    // 创建 style 标签

    applyCSSRule(
      `
        div[repr="lets-srs.review-session"] .orca-block-editor-none-editable,
        div[repr="lets-srs.review-session"] .orca-block-editor-go-btns,
        div[repr="lets-srs.review-session"] ~ .orca-block-editor-go-btns,
        div[repr="lets-srs.review-session"] ~ .orca-block-editor-sidetools {
          display: none;
        }
        div[repr="lets-srs.review-session"]{
          overflow-y: hidden;
        } 
        `,
      { id: RENDERER_TYPE },
    );

    // 1. 确保标签被初始化
    ensureCardTagSchema(this.name);

    // 2. 注册自定义块渲染器
    if (!orca.state.blockRenderers[RENDERER_TYPE]) {
      orca.renderers.registerBlock(
        RENDERER_TYPE,
        false,
        ReviewPanel,
        [],
        false,
      );
    }

    orca.converters.registerBlock("plain", RENDERER_TYPE, (block, repr) => {
      // 返回代表这个块的纯文本字符串。
      // 如果你的 repr 里存储了有用的信息，也可以提取出来返回，比如 return `[复习卡组: ${repr.title}]`;
      // 会被索引可搜索
      return "[SRS Review Session]";
    });

    if (!orca.state.commands[COMMAND_OPEN]) {
      orca.commands.registerCommand(
        COMMAND_OPEN,
        async () => {
          const activePanelId = orca.state.activePanel;
          if (!activePanelId) return;

          // 获取或创建会话块
          const blockId = await this.getOrCreateSessionBlock();

          // 尝试查找是否已经打开了复习面板
          let existingPanelId: string | null = null;
          for (const [id, panel] of Object.entries(orca.state.panels)) {
            if ((panel as any).viewArgs?.blockId === blockId) {
              existingPanelId = id;
              break;
            }
          }

          if (existingPanelId) {
            orca.nav.switchFocusTo(existingPanelId);
          } else {
            const newPanelId = orca.nav.addTo(activePanelId, "right", {
              view: "block",
              viewArgs: { blockId, repr: RENDERER_TYPE },
              viewState: {},
            } as any);

            if (newPanelId) {
              orca.nav.switchFocusTo(newPanelId);
            }
          }
        },
        t("Open SRS Review Panel"),
      );
    }

    if (orca.blockMenuCommands.registerBlockMenuCommand) {
      orca.blockMenuCommands.registerBlockMenuCommand(
        `${this.name}.roam-in-srs`,
        {
          worksOnMultipleBlocks: true,
          render: (blockIds, rootBlockId, close) => {
            const MenuText = orca.components.MenuText;
            if (!MenuText) return null;

            return (
              <MenuText
                key="roam-in-srs"
                title={t("Roam in SRS")}
                preIcon="ti ti-cards"
                onClick={async () => {
                  close();
                  if (!blockIds || blockIds.length === 0) return;

                  // 如果只选择了一个块，执行智能漫游逻辑
                  if (blockIds.length === 1) {
                    const blockId = blockIds[0];
                    const block =
                      orca.state.blocks[blockId] ||
                      (await orca.invokeBackend("get-block", blockId));
                    if (!block) return;

                    const repr = block.properties.find(
                      (p: any) => p.name === "_repr",
                    )?.value;

                    // 场景 A：查询块 - 漫游其结果
                    if (repr?.type === "query") {
                      try {
                        const queryDescription: QueryDescription2 = {
                          q: cloneDeep(repr.q.q),
                          page: 1,
                          pageSize: 1000,
                          sort: repr.viewOpts?.list?.sort
                            ? cloneDeep(repr.viewOpts?.list?.sort)
                            : [["_random", "DESC"]],
                          randomSeed: Date.now(),
                        } as QueryDescription2;

                        console.log("queryDescription", queryDescription);
                        const queryResults = (await orca.invokeBackend(
                          "query",
                          queryDescription,
                        )) as DbId[];

                        if (!queryResults?.length) {
                          orca.notify(
                            "warn",
                            t("No results found for the query."),
                          );
                          return;
                        }
                        this.handleRoam(queryResults, queryDescription);
                        return;
                      } catch (err) {
                        console.error("[lets-srs] Failed to query items", err);
                      }
                    }

                    // 场景 B：普通块 - 漫游相关块（引用 + 反链）
                    try {
                      const relatedIds = await this.getRelatedBlockIds(blockId);
                      if (relatedIds.length > 0) {
                        this.handleRoam(relatedIds);
                      } else {
                        // 如果没有相关块，至少漫游它自己
                        this.handleRoam([blockId]);
                      }
                    } catch (err) {
                      console.error("[lets-srs] smart roam failed", err);
                      this.handleRoam([blockId]);
                    }
                  } else {
                    // 否则漫游所有选中的块
                    this.handleRoam(blockIds);
                  }
                }}
              />
            );
          },
        },
      );
    }
  }

  private async getRelatedBlockIds(rootId: DbId): Promise<DbId[]> {
    const ids = new Set<DbId>();
    ids.add(rootId);

    // 1. 获取块树以递归处理子块
    const rootTree = await orca.invokeBackend("get-block-tree", rootId);
    rootTree.push(rootId);

    this.logger.info("Root tree", rootTree);
    const traverse = (node: any) => {
      console.log("traverse", node);
      if (!node) return;
      ids.add(node.id);

      // 收集出链 (Outgoing References)
      if (node.refs && Array.isArray(node.refs)) {
        node.refs.forEach((r: any) => {
          this.logger.info("Ref", r);
          if (r.to) ids.add(r.to);
        });
      }

      // 递归子块
      if (node.children && Array.isArray(node.children)) {
        // 如果 get-block-tree 返回的是展开的 Block 对象数组
        node.children.forEach((child: any) => {
          if (typeof child === "object") {
            traverse(child);
          } else {
            // 如果只有 ID，可能需要进一步获取，但 get-block-tree 通常是递归好的
            // 我们姑且认为它是递归的
          }
        });
      }
    };

    // traverse(rootTree);
    rootTree.forEach(async (blockId: any) => {
      let block = orca.state.blocks[blockId];
      // if (!block) {
      //   block = await orca.invokeBackend("get-block", blockId);
      // }
      traverse(block);
    });

    // 2. 获取根块的反链 (Incoming References / Backlinks)
    // 注意：backRefs 可能已经在 rootTree 中，由 get-block-tree 返回）
    if (
      orca.state.blocks[rootId]?.backRefs &&
      Array.isArray(orca.state.blocks[rootId].backRefs)
    ) {
      orca.state.blocks[rootId].backRefs.forEach((r: any) => {
        this.logger.info("Back ref", r);
        if (r.from) ids.add(r.from);
      });
    }

    this.logger.info("Related ids", ids);

    // 过滤掉 session 块自己（防止循环复习）
    if (this.sessionBlockId) {
      ids.delete(this.sessionBlockId);
    }

    return Array.from(ids);
  }

  private async handleRoam(blockIds: number[], query?: any) {
    const activePanelId = orca.state.activePanel;
    if (!activePanelId) return;

    const blockId = await this.getOrCreateSessionBlock();

    // 尝试查找是否已经打开了复习面板
    let existingPanelId: string | null = null;
    for (const [id, panel] of Object.entries(orca.state.panels)) {
      if ((panel as any).viewArgs?.blockId === blockId) {
        existingPanelId = id;
        break;
      }
    }

    if (existingPanelId) {
      orca.nav.switchFocusTo(existingPanelId);
    } else {
      const newPanelId = orca.nav.addTo(activePanelId, "right", {
        view: "block",
        viewArgs: {
          blockId,
          repr: RENDERER_TYPE,
          initialBlockIds: blockIds,
          query,
        },
        viewState: {},
      } as any);
      if (newPanelId) {
        orca.nav.switchFocusTo(newPanelId);
      }
    }
  }

  public renderHeadbarButton(): React.ReactNode {
    const Button = orca.components.Button;
    return (
      <Button
        variant="plain"
        onClick={() => orca.commands.invokeCommand(COMMAND_OPEN)}
        title={t("Spaced Repetition")}
      >
        <i className="ti ti-cards" style={{ fontSize: "16px" }} />
      </Button>
    );
  }

  protected renderHeadbarMenuItems(closeMenu: () => void): React.ReactNode[] {
    const MenuText = orca.components.MenuText;
    return [
      React.createElement(MenuText, {
        key: "open-bazaar",
        title: t("Spaced Repetition"),
        preIcon: "ti ti-cards",
        onClick: () => {
          closeMenu();
          orca.commands.invokeCommand(COMMAND_OPEN);
        },
      }),
      React.createElement(orca.components.MenuSeparator, {
        key: "sep-settings",
      }),
    ];
  }

  public getDefaultSettings(): any {
    return {
      ...super.getDefaultSettings(),
      cardTag: "Card",
    };
  }

  private async getOrCreateSessionBlock(): Promise<number> {
    if (this.sessionBlockId) {
      const block = orca.state.blocks[this.sessionBlockId];
      if (block) {
        (block as any)._repr = { type: RENDERER_TYPE };
        return this.sessionBlockId;
      }
    }

    // 尝试从插件配置中读取已有的 ID
    const storedId = await orca.plugins.getData(
      this.name,
      STORAGE_KEY_SESSION_BLOCK,
    );
    if (typeof storedId === "number") {
      const block =
        orca.state.blocks[storedId] ||
        (await orca.invokeBackend("get-block", storedId));
      if (block) {
        this.sessionBlockId = storedId;
        // 注入渲染器标记
        const stateBlock = orca.state.blocks[storedId];
        if (stateBlock) (stateBlock as any)._repr = { type: RENDERER_TYPE };
        return storedId;
      }
    }

    // 创建一个新的“虚拟”但持久的会话块
    const newBlockId = (await orca.commands.invokeEditorCommand(
      "core.editor.insertBlock",
      null,
      null,
      null,
      [{ t: "t", v: t("[SRS Review Session]") }],
      { type: RENDERER_TYPE },
    )) as number;

    await orca.plugins.setData(
      this.name,
      STORAGE_KEY_SESSION_BLOCK,
      newBlockId,
    );
    this.sessionBlockId = newBlockId;

    // 确保 state 中的 block 带有 _repr
    const block = orca.state.blocks[newBlockId];
    if (block) (block as any)._repr = { type: RENDERER_TYPE };

    return newBlockId;
  }

  public renderCustomSettings(
    settings: any,
    updateSettings: (val: any) => void,
  ): React.ReactNode {
    return (
      <SrsSettingsUI
        settings={settings}
        updateSettings={updateSettings}
        pluginName={this.name}
      />
    );
  }

  async unload() {
    console.log(`[${this.name}] plugin unloaded`);
    // orca.themes.removeCSSResources(this.name);
    removeCSSRule(RENDERER_TYPE);
    if (orca.state.blockRenderers[RENDERER_TYPE]) {
      orca.renderers.unregisterBlock(RENDERER_TYPE);
    }
    if (orca.state.commands[COMMAND_OPEN]) {
      orca.commands.unregisterCommand(COMMAND_OPEN);
    }
    if (orca.blockMenuCommands.unregisterBlockMenuCommand) {
      orca.blockMenuCommands.unregisterBlockMenuCommand(
        `${this.name}.roam-in-srs`,
      );
    }
  }
}

function SrsSettingsUI({
  settings,
  updateSettings,
  pluginName,
}: {
  settings: any;
  updateSettings: (val: any) => void;
  pluginName: string;
}) {
  const [localTag, setLocalTag] = useState(settings.cardTag || "Card");

  const handleConfirm = async () => {
    setCardTagAlias(localTag);
    updateSettings({ cardTag: localTag });
    await getOrCreateTagBlock(pluginName, localTag);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <SettingsSection title={t("SRS Settings")}>
        <SettingsItem
          label={t("Card Tag")}
          description={t("The tag used for cards.")}
        >
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <orca.components.Input
              value={localTag}
              onChange={(e: any) => setLocalTag(e.target.value)}
              placeholder="Card"
              style={{ flex: 1 }}
            />
            <orca.components.Button variant="solid" onClick={handleConfirm}>
              {t("Confirm and Create Tag")}
            </orca.components.Button>
          </div>
        </SettingsItem>
      </SettingsSection>
    </div>
  );
}
