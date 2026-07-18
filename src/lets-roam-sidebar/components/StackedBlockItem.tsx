import { t } from "@/libs/l10n";
import type { StackedBlock } from "../utils/state";

interface StackedBlockItemProps {
  block: StackedBlock;
  index: number;
  panelId: string;
  isDragging: boolean;
  showInsertionLine: boolean;
  onDragStart: (e: React.DragEvent, id: number) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onToggleCollapse: (id: number) => void;
  onRemove: (id: number) => void;
}

export const StackedBlockItem = ({
  block,
  index,
  panelId,
  isDragging,
  showInsertionLine,
  onDragStart,
  onDragEnd,
  onDragOver,
  onToggleCollapse,
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
                block.collapsed ? "ti ti-caret-right" : "ti ti-caret-down"
              }
              style={{ fontSize: "14px" }}
            />
          </div>
          <div style={{ flex: 1, overflow: "hidden" }}>
            <BlockBreadcrumb blockId={block.id} />
          </div>
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
        <div
          className="roam-sidebar-item-content"
          data-orca-block-root="true"
        >
          <Block
            key={`roam-block-${block.id}-${block.collapsed}`}
            panelId={panelId}
            blockId={block.id}
            blockLevel={0}
            indentLevel={0}
            renderingMode="normal"
            initiallyCollapsed={!!block.collapsed}
          />
        </div>
      </div>
    </>
  );
};
