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
          for (const [id, panel] of Object.entries(
            orca.state.panels.children,
          )) {
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
                      const currentSettings = this.getSettings();
                      const depth = currentSettings?.roamDepth ?? 3;
                      const hubCap = currentSettings?.roamHubCap ?? 50;
                      const relatedIds = await this.getRelatedBlockIds(blockId, depth, hubCap);
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

  private async getRelatedBlockIds(
    rootId: DbId,
    maxDepth: number = 3,
    hubCap: number = 50,
  ): Promise<DbId[]> {
    const weights: Record<number, number> = {};
    const addWeight = (id: number, weight: number) => {
      weights[id] = (weights[id] || 0) + weight;
    };

    const visitedHubs = new Set<number>();
    const queue: { id: number; depth: number }[] = [{ id: rootId, depth: 0 }];

    // 全局缓存，避免深搜时反复调接口
    const fetchedBlocks = new Map<number, any>();

    const fetchBlockSafely = async (id: number) => {
      if (fetchedBlocks.has(id)) return fetchedBlocks.get(id);
      let b = orca.state.blocks[id];
      if (!b) {
        try {
          b = await orca.invokeBackend("get-block", id);
        } catch (e) {
          // ignore
        }
      }
      if (b) fetchedBlocks.set(id, b);
      return b;
    };

    // 广度优先搜索 (BFS) 遍历语义群组
    while (queue.length > 0) {
      const { id: currentHubId, depth } = queue.shift()!;

      // 1. 直观且致命的熔断：如果节点超过最大深度限制（maxDepth=1表示最远跳跃0步），
      // 则连成为结果候选人的基础分数都不发给它，直接腰斩后续探索！
      if (depth >= maxDepth) continue;

      // 2. 每深一层，关联程度减半（100 -> 50 -> 25）
      const currentWeight = 100 * Math.pow(0.5, depth);
      addWeight(currentHubId, currentWeight);

      // 深层防死循环：如果该语义群组已被彻底解析过（或者作为 Hub 访问过了），则跳过子级展开
      // 但上面那行依然允许它累加由于多条路径跳过来的权重积分！
      if (visitedHubs.has(currentHubId)) continue;
      visitedHubs.add(currentHubId);

      // 如果到达限制深度，停止向外发出新的辐射（探索结束边界）
      if (depth >= maxDepth) continue;

      // --- 关键抽象：语义群组作为统一采集器 ---
      // 不把子节点当做漫游目标，但把子节点里包藏的所有引线全挖出来
      let treeIds: number[] = [];
      try {
        treeIds =
          (await orca.invokeBackend("get-block-tree", currentHubId)) || [];
      } catch (e) {}
      if (!treeIds.includes(currentHubId)) treeIds.push(currentHubId);

      const outgoingRefs = new Set<number>();
      const incomingRefs = new Set<number>();

      for (const tId of treeIds) {
        const block = await fetchBlockSafely(tId);
        if (!block) continue;

        // 收集出链 (标签也是一种类型特殊的 refs)
        if (block.refs && Array.isArray(block.refs)) {
          block.refs.forEach((r: any) => {
            if (r.to) {
              // 特殊：我们给予正链（你主动提到的事物）略高一点优先权，
              // 在压入队列时可以在这做分化，目前靠衰减已经很优雅了
              outgoingRefs.add(r.to);
            }
          });
        }

        // 收集反链 (指向我们的节点，即有谁引用了这个群组的内容)
        if (block.backRefs && Array.isArray(block.backRefs)) {
          block.backRefs.forEach((r: any) => {
            if (r.from) incomingRefs.add(r.from);
          });
        }
      }

      // --- 熔断保护：Hub 黑洞防御 ---
      // 如果漫游碰到了像 #Idea 或者 #Card 这种含有上千的反链的全局巨无霸节点，
      // 我们强行把流入队列的支流限制在 50 条以内，以防内存或者查询耗时爆炸。
      let incomingArray = Array.from(incomingRefs);
      if (incomingArray.length > hubCap) {
        this.logger.warn(
          `[lets-srs] Hub ${currentHubId} exploded with ${incomingArray.length} backlinks. Capped to ${hubCap}.`,
        );
        // 最好是取点随机样本，这里简单截断前 hubCap
        incomingArray = incomingArray.slice(0, hubCap);
      }

      for (const targetId of outgoingRefs) {
        queue.push({ id: targetId, depth: depth + 1 });
      }
      for (const targetId of incomingArray) {
        queue.push({ id: targetId, depth: depth + 1 });
      }
    }

    // 后处理阶段
    let candidateIds = Object.keys(weights).map(Number);
    if (this.sessionBlockId) {
      candidateIds = candidateIds.filter((id) => id !== this.sessionBlockId);
    }

    const finalIds: number[] = [];

    // 防空壳过滤 (保留了老配方：既不是文档又没内容，再见！)
    for (const id of candidateIds) {
      const b = await fetchBlockSafely(id);
      if (!b) continue;

      const hasContent = !!(b.content && b.content.length > 0);
      const isDocument = b.repr?.type === "document";
      const hasChildren = !!(b.children && b.children.length > 0);

      if (!hasContent && !isDocument && !hasChildren) {
        continue;
      }
      finalIds.push(id);
    }

    // 严谨排序与局部洗牌
    finalIds.sort((a, b) => {
      const wA = weights[a] || 0;
      const wB = weights[b] || 0;
      const diff = wB - wA;

      // 衰减算法下的局部洗牌：当两个块的积分差只有不到 15 分时
      // （例如都是从上一层发散出来的平行分支）让它们随机乱序
      if (Math.abs(diff) <= 15) {
        return Math.random() - 0.5;
      }
      return diff;
    });

    this.logger.info(
      "Zettelkasten BFS roamed blocks:",
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
      roamDepth: 3,
      roamHubCap: 50,
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
        <SettingsItem
          label={t("Roam Depth (1-5)")}
          description={t("How deep the roaming algorithm explores related blocks. Higher means broadly related (but much slower).")}
        >
          <orca.components.Input
            type="number"
            min={2}
            max={8}
            value={settings.roamDepth ?? 2}
            onChange={(e: any) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val)) updateSettings({ roamDepth: val });
            }}
          />
        </SettingsItem>
        <SettingsItem
          label={t("Roam Hub Cap (10-500)")}
          description={t("Maximum number of backlinks to explore per node (protects against tag blackholes).")}
        >
          <orca.components.Input
            type="number"
            min={10}
            max={500}
            value={settings.roamHubCap ?? 50}
            onChange={(e: any) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val)) updateSettings({ roamHubCap: val });
            }}
          />
        </SettingsItem>
      </SettingsSection>
    </div>
  );
}
