import React, { useCallback } from "react";
import { useSnapshot } from "valtio";
import { t } from "@/libs/l10n";
import {
  blockNavState,
  toggleSelect,
  selectRange,
  toggleExpand,
  BlockNavItem,
} from "../utils/state";

interface BlockNodeItemProps {
  item: BlockNavItem;
  onNavigate: (blockId: number) => void;
  onDropOnNode: (blockIds: number[], targetId: number) => void;
}

export const BlockNodeItem: React.FC<BlockNodeItemProps> = ({
  item,
  onNavigate,
  onDropOnNode,
}) => {
  const state = useSnapshot(blockNavState);
  const isSelected = state.selectedIds.has(item.id);
  const isExpanded = state.expandedIds.has(item.id);
  const hasChildren = item.children && item.children.length > 0;

  const [isDragOver, setIsDragOver] = React.useState(false);
  const dragCounter = React.useRef(0);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (e.shiftKey) {
        selectRange(item.id);
      } else if (e.ctrlKey || e.metaKey) {
        toggleSelect(item.id, true);
      } else {
        onNavigate(item.id);
      }
    },
    [item.id, onNavigate]
  );

  const handleCheckboxChange = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      toggleSelect(item.id, e.ctrlKey || e.metaKey);
    },
    [item.id]
  );

  const handleExpandClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      toggleExpand(item.id);
    },
    [item.id]
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setIsDragOver(false);

      const types = Array.from(e.dataTransfer.types);
      const orcaRepoType = types.find((t) => {
        const parts = t.split("/");
        return parts.length === 2 && parts[0] === "orca";
      });
      const data = orcaRepoType ? e.dataTransfer.getData(orcaRepoType) : "";
      if (!data) return;

      try {
        const parsed = JSON.parse(data);
        let ids: number[] = [];
        if (parsed.id) ids.push(Number(parsed.id));
        else if (Array.isArray(parsed.blocks)) ids = parsed.blocks.map(Number);
        else if (Array.isArray(parsed.blockIds))
          ids = parsed.blockIds.map(Number);

        if (ids.length > 0) {
          onDropOnNode(ids, item.id);
        }
      } catch (err) {
        console.error("[BlockNav] Failed to parse drop data:", err);
      }
    },
    [item.id, onDropOnNode]
  );

  return (
    <div
      className={`block-nav-node ${isSelected ? "block-nav-node-selected" : ""} ${isDragOver ? "block-nav-node-drag-over" : ""}`}
      onClick={handleClick}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="block-nav-node-checkbox" onClick={handleCheckboxChange}>
        <i className={isSelected ? "ti ti-checkbox" : "ti ti-square"} />
      </div>

      {hasChildren ? (
        <div className="block-nav-node-expand" onClick={handleExpandClick}>
          <i className={isExpanded ? "ti ti-caret-down" : "ti ti-caret-right"} />
        </div>
      ) : (
        <div className="block-nav-node-expand" />
      )}

      <div className="block-nav-node-content">
        <span className="block-nav-node-title">{item.text}</span>
        {hasChildren && (
          <span className="block-nav-node-count">{item.children!.length}</span>
        )}
      </div>
    </div>
  );
};
