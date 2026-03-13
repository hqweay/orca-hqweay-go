import { BasePlugin } from "@/libs/BasePlugin";
import { t } from "@/libs/l10n";
import React from "react";

/**
 * Task Card Block Representation:
 * {
 *   type: "lets-test-block.task-card",
 *   status: "todo" | "done",
 *   priority: "high" | "medium" | "low",
 *   title: string
 * }
 */

export default class TestBlockPlugin extends BasePlugin {
  protected blockType = `${this.name}.task-card`;
  protected headbarButtonId = `${this.name}.insert-task-card-btn`;

  public renderHeadbarButton(): React.ReactNode {
    const Button = orca.components.Button;
    const Tooltip = orca.components.Tooltip;
    return (
      <Tooltip text={t("Insert Task Card")}>
        <Button
          variant="plain"
          onClick={() =>
            orca.commands.invokeEditorCommand(
              `${this.name}.insert-task-card`,
              null,
            )
          }
        >
          <i className="ti ti-plus" />
        </Button>
      </Tooltip>
    );
  }

  public async load(): Promise<void> {
    // 1. Register Renderer
    // Arguments: type, isEditable, rendererComponent, assetFields, useChildren
    orca.renderers.registerBlock(this.blockType, true, TaskCardRenderer);

    // 2. Register Markdown Converter (The "Twin" principle)
    orca.converters.registerBlock(
      "plain",
      this.blockType,
      (_blockContent: any, repr: any) => {
        const statusIcon = repr.status === "done" ? "[x]" : "[ ]";
        const priorityLabel = repr.priority
          ? `(${repr.priority.toUpperCase()})`
          : "";
        const title = repr.title || "";
        return `${statusIcon} ${priorityLabel} ${title}`;
      },
    );

    // 3. Register Command to insert the block
    orca.commands.registerEditorCommand(
      `${this.name}.insert-task-card`,
      // 回调函数的参数是一个数组：[panelId, rootBlockId, cursor]
      async ([_panelId, _rootBlockId, cursor]) => {
        this.logger.info("Inserting Task Card");

        // 1. 安全检查：光标可能为空（例如焦点不在编辑器内）
        if (!cursor || !cursor.anchor) {
          this.logger.warn("No cursor found");
          return null;
        }

        this.logger.info("Cursor Block ID: " + cursor.anchor.blockId);

        // 获取当前光标所在的 Block 对象
        // 注意：通常使用 cursor.anchor.blockId 获取当前块
        const currentBlock = orca.state.blocks[cursor.anchor.blockId];
        if (!currentBlock) return null;

        // 2. 调用核心编辑器命令插入新块
        // signature: invokeEditorCommand(commandId, cursor, ...args)
        await orca.commands.invokeEditorCommand(
          "core.editor.insertBlock",
          cursor, // 必须传入 cursor
          currentBlock, // 参考块 (refBlock)
          "after", // 插入位置
          [], // content (空内容)
          {
            // repr (自定义属性)
            type: this.blockType,
            status: "todo",
            priority: "medium",
            title: t("New Task Card"), // 建议使用 l10n.t
          },
        );

        this.logger.info("Task Card Inserted");
        return null; // 编辑器命令通常返回 null 或 void
      },
      // Undo 函数 (通常简单的插入操作核心会自动处理，留空即可)
      () => {},
      { label: t("Insert Task Card") },
    );
    this.logger.info("Test Block Plugin loaded");
  }

  public async unload(): Promise<void> {
    orca.renderers.unregisterBlock(this.blockType);
    orca.converters.unregisterBlock("markdown", this.blockType);
    orca.commands.unregisterEditorCommand(`${this.name}.insert-task-card`);
    this.logger.info("Test Block Plugin unloaded");
  }
}

function TaskCardRenderer(props: any) {
  const { blockId, panelId, rndId, blockLevel, indentLevel } = props;
  const { useSnapshot } = (window as any).Valtio;
  const block = useSnapshot(orca.state.blocks[blockId]);

  if (!block) return null;

  const repr = block._repr || {};
  const status = repr.status || "todo";
  const priority = repr.priority || "medium";
  const title = repr.title || "";

  const Button = orca.components.Button;

  // Function to toggle status
  const toggleStatus = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextStatus = status === "todo" ? "done" : "todo";
    await orca.commands.invokeEditorCommand("core.editor.setBlocksRepr", null, [
      { id: blockId, _repr: { ...repr, status: nextStatus } },
    ]);
  };

  // Function to change priority
  const cyclePriority = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const priorities = ["low", "medium", "high"];
    const nextPriority =
      priorities[(priorities.indexOf(priority) + 1) % priorities.length];
  };

  const getPriorityColor = () => {
    switch (priority) {
      case "high":
        return "var(--b3-theme-error)";
      case "medium":
        return "var(--b3-theme-warning)";
      case "low":
        return "var(--b3-theme-info)";
      default:
        return "inherit";
    }
  };

  const contentJsx = (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "8px 12px",
        background: "var(--b3-theme-surface)",
        border: `1px solid ${status === "done" ? "var(--b3-theme-surface-lighter)" : "var(--b3-theme-primary-light)"}`,
        borderRadius: "8px",
        opacity: status === "done" ? 0.6 : 1,
        transition: "all 0.2s ease",
        userSelect: "none",
        margin: "4px 0",
      }}
    >
      {/* Status Toggle */}
      <div
        onClick={toggleStatus}
        style={{
          cursor: "pointer",
          fontSize: "20px",
          color:
            status === "done"
              ? "var(--b3-theme-primary)"
              : "var(--b3-theme-on-surface-light)",
        }}
      >
        <i className={status === "done" ? "ti ti-checkbox" : "ti ti-square"} />
      </div>

      {/* Title */}
      <div
        style={{
          flex: 1,
          fontSize: "15px",
          textDecoration: status === "done" ? "line-through" : "none",
          fontWeight: "500",
        }}
      >
        {title}
      </div>

      {/* Priority Badge */}
      <div
        onClick={cyclePriority}
        style={{
          cursor: "pointer",
          padding: "2px 8px",
          borderRadius: "4px",
          fontSize: "11px",
          fontWeight: "bold",
          textTransform: "uppercase",
          backgroundColor: `${getPriorityColor()}22`,
          color: getPriorityColor(),
          border: `1px solid ${getPriorityColor()}44`,
        }}
      >
        {priority}
      </div>
    </div>
  );

  // We MUST use BlockShell to wrap custom blocks to ensure standard editor behavior (drag, indentation, etc.)
  return (
    <orca.components.BlockShell
      panelId={panelId}
      blockId={blockId}
      rndId={rndId}
      blockLevel={blockLevel}
      indentLevel={indentLevel}
      contentJsx={contentJsx}
      childrenJsx={
        <orca.components.BlockChildren
          panelId={panelId}
          block={block as any}
          blockLevel={blockLevel}
          indentLevel={indentLevel}
        />
      }
      editable={false} // Our custom UI handles its own state
    />
  );
}
