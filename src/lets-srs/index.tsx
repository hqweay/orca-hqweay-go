import { DbId, PanelProps } from "@/orca";
import { BasePlugin } from "../libs/BasePlugin";
import { t } from "../libs/l10n";
import { ensureCardTagSchema } from "./core/tagSchema";
import { ReviewPanel } from "./ui/review-panel";
import applyCSSRule, { removeCSSRule } from "@/libs/styleUtil";
import React from "react";

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

    // orca.themes.injectCSSResource("./ui/srs.css", this.name);

    // 创建 style 标签

    applyCSSRule(
      `

    div[repr="lets-srs.review-session"] .orca-block-editor-none-editable, .orca-block-editor-go-btns, .orca-block-editor-sidetools {
      display: none;
    }`,
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

                  // 如果只选择了一个块且是查询块，则漫游其结果
                  if (blockIds.length === 1) {
                    const blockId = blockIds[0];
                    const block = orca.state.blocks[blockId];
                    const queryBlockRepr = block?.properties.find(
                      (p: any) => p.name === "_repr",
                    )?.value;

                    this.logger.info("Query block repr", queryBlockRepr);
                    if (queryBlockRepr?.type !== "query") {
                      orca.notify(
                        "error",
                        t("Please give a valid query block."),
                      );
                      return;
                    }

                    queryBlockRepr.q.page = 1;
                    queryBlockRepr.q.pageSize = 1000;
                    const queryResults: DbId[] = await orca.invokeBackend(
                      "query",
                      queryBlockRepr.q,
                    );

                    this.logger.info("Query results22", queryResults);
                    if (!queryResults?.length) {
                      orca.notify("warn", t("No results found for the query."));
                      return;
                    }

                    this.logger.info("Query results", queryResults);
                    this.handleRoam(queryResults);
                  } else {
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

  private async handleRoam(blockIds: number[]) {
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
      [{ t: "t", v: `[SRS Review Session]` }],
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
