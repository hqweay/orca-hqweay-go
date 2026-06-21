import React, { useCallback } from "react";
import { useSnapshot } from "valtio";
import { t } from "@/libs/l10n";
import {
  blockNavState,
  BlockNavItem,
} from "../utils/state";

interface BlockNodeItemProps {
  item: BlockNavItem;
  isFocused: boolean;
  onNavigate: (blockId: number) => void;
  onDropOnNode: (blockIds: number[], targetId: number, position: "before" | "after" | "inside") => void;
}

export const BlockNodeItem: React.FC<BlockNodeItemProps> = ({
  item,
  isFocused,
  onNavigate,
  onDropOnNode,
}) => {
  const state = useSnapshot(blockNavState);
  const hasChildren = item.children && item.children.length > 0;

  const [isDragOver, setIsDragOver] = React.useState(false);
  const dragCounter = React.useRef(0);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onNavigate(item.id);
    },
    [item.id, onNavigate]
  );
  const [dropPosition, setDropPosition] = React.useState<"before" | "after" | "inside" | null>(null);

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
      setDropPosition(null);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = e.clientY - rect.top;
    if (y < rect.height * 0.25) {
      setDropPosition("before");
    } else if (y > rect.height * 0.75) {
      setDropPosition("after");
    } else {
      setDropPosition("inside");
    }
  }, []);

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      const repoId = orca.state.repo || "default";
      const ids = [item.id];
      e.dataTransfer.setData(
        `orca/${repoId}`,
        JSON.stringify({ blocks: ids })
      );
      e.dataTransfer.setData("text/plain", ids.join(","));
      e.dataTransfer.effectAllowed = "copyMove";
    },
    [item.id]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setIsDragOver(false);
      const currentPos = dropPosition;
      setDropPosition(null);

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
          onDropOnNode(ids, item.id, currentPos || "inside");
        }
      } catch (err) {
        console.error("[BlockNav] Failed to parse drop data:", err);
      }
    },
    [item.id, onDropOnNode, dropPosition]
  );

  let dropClassName = "";
  if (isDragOver && dropPosition) {
    if (dropPosition === "before") dropClassName = "block-nav-node-drop-before";
    else if (dropPosition === "after") dropClassName = "block-nav-node-drop-after";
    else dropClassName = "block-nav-node-drag-over"; // inside
  }

  return (
    <div
      className={`block-nav-node ${isFocused ? "block-nav-node-selected" : ""} ${dropClassName}`}
      draggable={true}
      onClick={handleClick}
      onDragStart={handleDragStart}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="block-nav-node-content">
        <span className="block-nav-node-title">{item.text}</span>
        {hasChildren && (
          <span className="block-nav-node-count">{item.children!.length}</span>
        )}
      </div>
    </div>
  );
};
