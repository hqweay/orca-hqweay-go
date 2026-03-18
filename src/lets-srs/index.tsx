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
 * 1. 自动注册 #Card 标签 Schema（属性：Due, Type, Interval, Reps, srsData）
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
    const weights: Record<number, number> = {};
    const addWeight = (id: number, weight: number) => {
      weights[id] = (weights[id] || 0) + weight;
    };

    // 1. 获取块树（包含自己及所有子孙节点 ID）
    const rootTreeIds: number[] =
      (await orca.invokeBackend("get-block-tree", rootId)) || [];
    if (!rootTreeIds.includes(rootId)) {
      rootTreeIds.push(rootId);
    }

    // 2. 分配基础权重
    addWeight(rootId, 100); // 根节点权重最高
    rootTreeIds.forEach((id) => {
      if (id !== rootId) addWeight(id, 80); // 树内子孙节点权重极高
    });

    const fetchedBlocks = new Map<number, any>();
    const processedIds = new Set<number>();

    // 3. 安全获取所有树内节点的实际内容（解决老代码 forEach+async 的严重丢块 bug）
    for (const id of rootTreeIds) {
      if (processedIds.has(id)) continue;
      processedIds.add(id);

      let block = orca.state.blocks[id];
      if (!block) {
        try {
          block = await orca.invokeBackend("get-block", id);
        } catch (e) {
          // ignore
        }
      }
      if (block) fetchedBlocks.set(id, block);
    }

    // 4. 收集出链 (Outgoing References) 和分配权重
    for (const block of fetchedBlocks.values()) {
      if (block.refs && Array.isArray(block.refs)) {
        block.refs.forEach((r: any) => {
          if (r.to) {
            addWeight(r.to, 50); // 树内节点向外的出链权重中等
          }
        });
      }
    }

    // 5. 收集根节点的反链 (Incoming References)
    const rootBlock = fetchedBlocks.get(rootId);
    if (rootBlock && rootBlock.backRefs && Array.isArray(rootBlock.backRefs)) {
      rootBlock.backRefs.forEach((r: any) => {
        if (r.from) {
          addWeight(r.from, 30); // 别人链向根节点，权重较低（作为扩展阅读）
        }
      });
    }

    // 整理收集到的所有侯选 ID
    let candidateIds = Object.keys(weights).map(Number);

    // 过滤掉当前用于临时会话自身的块
    if (this.sessionBlockId) {
      candidateIds = candidateIds.filter((id) => id !== this.sessionBlockId);
    }

    const finalIds: number[] = [];

    // 6. 防空壳节点过滤与合法性校验
    for (const id of candidateIds) {
      let b = fetchedBlocks.get(id);
      if (!b) {
        b = orca.state.blocks[id];
        if (!b) {
          try {
            b = await orca.invokeBackend("get-block", id);
          } catch (e) {
            continue;
          }
        }
      }
      if (!b) continue;

      // 判断空壳：没有正文、不是文档节点、没有子节点，就丢弃
      const hasContent = !!(b.content && b.content.length > 0);
      const isDocument = b.repr?.type === "document";
      const hasChildren = !!(b.children && b.children.length > 0);

      if (!hasContent && !isDocument && !hasChildren) {
        // this.logger.info("Filtered empty shell block:", id);
        continue;
      }
      finalIds.push(id);
    }

    // 7. 权重衰减排序 + 局部洗牌算法 (Local Shuffle)
    finalIds.sort((a, b) => {
      const wA = weights[a] || 0;
      const wB = weights[b] || 0;
      const diff = wB - wA;

      // 如果权重非常接近 (差异 <= 20)，引入随机扰动，达到局部洗牌效果，每次漫游有一点随机连结感
      if (Math.abs(diff) <= 20) {
        return Math.random() - 0.5;
      }

      // 差异大的严格按照权重降序排列
      return diff;
    });

    this.logger.info(
      "Smart sorted roaming blocks:",
      finalIds.map((id) => ({ id, weight: weights[id] })),
    );

    return finalIds;
  }

  private async handleRoam(blockIds: number[], query?: any) {
    const activePanelId = orca.state.activePanel;
    if (!activePanelId) return;

    const blockId = await this.getOrCreateSessionBlock();

    // 尝试查找是否已经打开了复习面板
    // let existingPanelId: string | null = null;
    // for (const [id, panel] of Object.entries(orca.state.panels.children)) {
    //   if ((panel as any).viewArgs?.blockId === blockId) {
    //     existingPanelId = id;
    //     break;
    //   }
    // }

    // if (existingPanelId) {
    //   orca.nav.switchFocusTo(existingPanelId);
    // } else {
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
    // }
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
