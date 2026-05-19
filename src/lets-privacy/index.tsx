import React, { useMemo } from "react";
import { BasePlugin } from "@/libs/BasePlugin";
import { t } from "@/libs/l10n";
import { getRepr } from "@/libs/utils";
import { useSnapshot } from "valtio";
import { Block } from "@/orca";

const { BlockShell, BlockChildren } = orca.components;

function PrivacyBlockRenderer({
  panelId,
  blockId,
  rndId,
  blockLevel,
  indentLevel,
  mirrorId,
  initiallyCollapsed,
  renderingMode,
  src,
}: any) {
  const { blocks } = useSnapshot(orca.state);
  const block = blocks[mirrorId ?? blockId];

  const childrenJsx = useMemo(
    () => (
      <BlockChildren
        block={block as Block}
        panelId={panelId}
        blockLevel={blockLevel}
        indentLevel={indentLevel}
        renderingMode={renderingMode}
      />
    ),
    [block, panelId, blockLevel, indentLevel, renderingMode],
  );
  const { Block } = orca.components;

  return <div>11</div>;

  return (
    <BlockShell
      panelId={panelId}
      blockId={blockId}
      rndId={rndId}
      mirrorId={mirrorId}
      blockLevel={blockLevel}
      indentLevel={indentLevel}
      initiallyCollapsed={initiallyCollapsed}
      renderingMode={renderingMode}
      contentJsx={
        <Block
          key={blockId}
          panelId={panelId}
          blockId={blockId}
          blockLevel={0}
          indentLevel={0}
          renderingMode="normal"
          initiallyCollapsed={false}
        />
      }
      childrenJsx={childrenJsx}
    />
  );
}

export default class PrivacyPlugin extends BasePlugin {
  // 定义 headbarButtonId 即可在主设置页看到此插件的开关
  protected headbarButtonId = "lets-privacy";

  async load() {
    // 1. 注册渲染器。
    // isEditable=true 代表我们允许该 Block 继续使用原生文本编辑器，不影响编辑体验。
    orca.renderers.registerBlock(
      "lets.privacy",
      false,
      PrivacyBlockRenderer,
      ["src"],
      // false,
    );

    // 2. 注册转换器，切断 AI 读取、纯文本复制和导出的明文输出。
    orca.converters.registerBlock("plain", "lets.privacy", () => {
      return `[🔒 ${t("privacy.hiddenMessage")}]`;
    });

    orca.converters.registerBlock("markdown", "lets.privacy", () => {
      return `> [🔒 ${t("privacy.hiddenMessage")}]`;
    });

    // 3. 注册菜单命令，提供用户切换该 Block 状态的能力
    orca.blockMenuCommands.registerBlockMenuCommand("lets.privacy.toggle", {
      render: (blockIds: any, _rootBlockId: any, close: any) => {
        const blockId = Array.isArray(blockIds) ? blockIds[0] : blockIds;
        console.log("blockId", blockId);
        if (!blockId) return null;

        const block = orca.state.blocks[blockId];
        if (!block) return null;

        const repr = getRepr(block);
        console.log("repr", repr);
        const isPrivacy = repr?.type === "lets.privacy";
        const icon = isPrivacy ? "ti ti-lock-open" : "ti ti-lock";

        this.logger.info("isPrivacy", isPrivacy);

        return (
          <orca.components.MenuText
            preIcon={icon}
            title={t("privacy.toggle")}
            onClick={async () => {
              close();
              if (isPrivacy) {
                await orca.commands.invokeEditorCommand(
                  "core.editor.setProperties",
                  null,
                  [blockId],
                  [
                    {
                      name: "_repr",
                      type: 0, // Text/JSON type
                      value: { type: "text" },
                    },
                  ],
                );
              } else {
                // 设为隐私块：覆盖/新增 _repr 属性
                // 获取旧的 _repr
                const oldRepr = (block as any)._repr || {};
                await orca.commands.invokeEditorCommand(
                  "core.editor.setProperties",
                  null,
                  [block.id],
                  [
                    {
                      name: "_repr",
                      value: {
                        ...oldRepr,
                        type: "lets.privacy",
                        src: "加密啰",
                      },
                      type: 0,
                    },
                  ],
                );
              }
            }}
          />
        );
      },
    } as any);

    // 4. 注入样式：加个左边框或锁的提示图标
    orca.themes.injectCSS(
      `
      .lets-privacy-block .orca-block-content-container {
        border-left: 3px solid var(--orca-color-error, #f04438);
        background-color: var(--orca-color-bg-2);
        padding-left: 8px;
        border-radius: 4px;
        position: relative;
      }
      .lets-privacy-block .orca-block-content-container::after {
        content: "🔒";
        position: absolute;
        right: 4px;
        top: 2px;
        font-size: 14px;
        opacity: 0.3;
        pointer-events: none;
      }
      `,
      "lets-privacy-css",
    );
    // 5. 注册插入隐私块的编辑器命令
    orca.commands.registerEditorCommand(
      `${this.name}.insert`,
      async ([_panelId, _rootBlockId, cursor]) => {
        if (!cursor || !cursor.anchor) {
          this.logger.warn("No cursor found");
          return null;
        }

        const currentBlock = orca.state.blocks[cursor.anchor.blockId];
        if (!currentBlock) return null;

        await orca.commands.invokeEditorCommand(
          "core.editor.insertBlock",
          cursor,
          currentBlock,
          "after",
          [],
          { type: "lets.privacy" },
        );

        return null;
      },
      () => {},
      { label: t("privacy.insert") },
    );
  }

  public renderHeadbarButton(): React.ReactNode {
    const Button = orca.components.Button;
    const Tooltip = orca.components.Tooltip;
    return (
      <Tooltip text={t("privacy.insert")}>
        <Button
          variant="plain"
          onClick={() =>
            orca.commands.invokeEditorCommand(`${this.name}.insert`, null)
          }
        >
          <i className="ti ti-lock" />
        </Button>
      </Tooltip>
    );
  }

  async unload() {
    orca.renderers.unregisterBlock("lets.privacy");
    orca.converters.unregisterBlock("plain", "lets.privacy");
    orca.converters.unregisterBlock("markdown", "lets.privacy");
    orca.blockMenuCommands.unregisterBlockMenuCommand("lets.privacy.toggle");
    orca.commands.unregisterEditorCommand(`${this.name}.insert`);
    orca.themes.removeCSS("lets-privacy-css");
  }
}
