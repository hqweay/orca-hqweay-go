import { t } from "@/libs/l10n";
import type { StackedBlock } from "../utils/state";

interface StackedBlockItemProps {
  block: StackedBlock;
  index: number;
  panelId: string;
  isDragging: boolean;
  showInsertionLine: boolean;
  childCount?: number;
  onDragStart: (e: React.DragEvent, id: number) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onToggleCollapse: (id: number) => void;
  onToggleExpanded: (id: number) => void;
  onRemove: (id: number) => void;
}

export const StackedBlockItem = ({
  block,
  index,
  panelId,
  isDragging,
  showInsertionLine,
  childCount = 0,
  onDragStart,
  onDragEnd,
  onDragOver,
  onToggleCollapse,
  onToggleExpanded,
  onRemove,
}: StackedBlockItemProps) => {
  const Block = orca.components.Block;
  const BlockBreadcrumb = orca.components.BlockBreadcrumb;

  return (
    <>
      {showInsertionLine && <div className="roam-sidebar-insertion-line" />}
      <div
        className={`roam-sidebar-item ${isDragging ? "roam-sidebar-item-dragging" : ""}`}
        draggable={true}
        onDragStart={(e) => onDragStart(e, block.id)}
        onDragEnd={onDragEnd}
        onDragOver={(e) => onDragOver(e, index)}
      >
        <div
          className="roam-sidebar-item-breadcrumb"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "4px 8px 4px 12px",
          }}
        >
          <div
            className="roam-sidebar-item-drag-handle"
            contentEditable={false}
            title={t("roam-sidebar.drag-to-reorder")}
          >
            <i className="ti ti-grip-vertical" />
          </div>
          <div
            contentEditable={false}
            style={{
              cursor: "pointer",
              marginRight: "8px",
              display: "flex",
              alignItems: "center",
            }}
            onClick={() => onToggleCollapse(block.id)}
          >
            <i
              className={
                block.collapsed ? "ti ti-eye-off" : "ti ti-eye"
              }
              style={{ fontSize: "14px" }}
            />
          </div>
          <div style={{ flex: 1, overflow: "hidden" }} contentEditable={false}>
            <BlockBreadcrumb blockId={block.id} />
          </div>
          {block.collapsed && childCount > 0 && (
            <span
              contentEditable={false}
              style={{
                fontSize: "11px",
                opacity: 0.4,
                marginRight: "4px",
                flexShrink: 0,
              }}
            >
              ({childCount})
            </span>
          )}
          {!block.collapsed && (
            <div
              contentEditable={false}
              style={{
                cursor: "pointer",
                marginRight: "4px",
                display: "flex",
                alignItems: "center",
              }}
              onClick={() => onToggleExpanded(block.id)}
              title={block.expanded ? t("roam-sidebar.collapse-content") : t("roam-sidebar.expand-content")}
            >
              <i
                className={block.expanded ? "ti ti-chevrons-up" : "ti ti-chevrons-down"}
                style={{ fontSize: "14px" }}
              />
            </div>
          )}
          <div
            className="roam-sidebar-item-close-action"
            title={t("roam-sidebar.close-card")}
            onClick={(e) => {
              e.stopPropagation();
              onRemove(block.id);
            }}
            style={{
              padding: "4px",
              cursor: "pointer",
              opacity: 0.6,
              fontSize: "14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "4px",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "1";
              e.currentTarget.style.color =
                "var(--orca-color-danger-5, #ef4444)";
              e.currentTarget.style.backgroundColor =
                "var(--orca-color-danger-1, #fee2e2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "0.6";
              e.currentTarget.style.color = "";
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <i className="ti ti-x" />
          </div>
        </div>
        {!block.collapsed && (
          <div
            className="roam-sidebar-item-content"
            data-orca-block-root="true"
            style={{
              paddingLeft: "20px",
              ...(!block.expanded ? { maxHeight: "150px", overflowY: "auto" } : {}),
            }}
          >
            <Block
              panelId={panelId}
              blockId={block.id}
              blockLevel={0}
              indentLevel={0}
              renderingMode="normal"
            />
          </div>
        )}
      </div>
    </>
  );
};
