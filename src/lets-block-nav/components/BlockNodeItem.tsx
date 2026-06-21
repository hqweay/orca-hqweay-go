import React, { useCallback, useEffect } from "react";
import { useSnapshot } from "valtio";
import {
  blockNavState,
  toggleNodeExpansion,
  searchCache,
} from "../utils/state";
import { BlockIcon } from "../../libs/components/BlockIcon";
import { getBlockTitle as getBlockTitleUtil, getBlockIcon, getBlockColor, ensureBlockInState } from "../../libs/utils";

interface BlockNodeItemProps {
  blockId: number;
  depth: number;
  focusedBlockId: number | null;
  onNavigate: (blockId: number) => void;
  onRightClick: (blockId: number) => void;
  onDropOnNode: (blockIds: number[], targetId: number, position: "before" | "after" | "inside") => void;
}

export const BlockNodeItem: React.FC<BlockNodeItemProps> = ({
  blockId,
  depth,
  focusedBlockId,
  onNavigate,
  onRightClick,
  onDropOnNode,
}) => {
  const state = useSnapshot(blockNavState);
  const isSearching = state.isSearching;
  
  // Use searchCache if searching, otherwise use reactive blocks
  const stateBlock = useSnapshot(orca.state).blocks[blockId];
  const block = isSearching ? (searchCache.map.get(blockId) || stateBlock) : stateBlock;
  
  const isMatched = isSearching ? !!state.searchMatchedIds[blockId] : false;
  const isExpandedAncestor = isSearching ? !!state.searchExpandedIds[blockId] : false;
  
  const isExpanded = isSearching 
    ? isExpandedAncestor 
    : !!state.expandedIds[blockId];
    
  const isFocused = blockId === focusedBlockId;
  const childrenIds = block?.children || [];
  // When searching, if a node is matched but isn't an ancestor to other matches, we don't need to expand it to show its children
  const hasChildren = childrenIds.length > 0 && (!isSearching || isExpandedAncestor);

  const [isDragOver, setIsDragOver] = React.useState(false);
  const dragCounter = React.useRef(0);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onNavigate(blockId);
    },
    [blockId, onNavigate]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onRightClick(blockId);
    },
    [blockId, onRightClick]
  );

  const handleToggle = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      toggleNodeExpansion(blockId);
      
      // If we are expanding, ensure children are loaded in memory
      if (!isExpanded && hasChildren) {
        for (const childId of childrenIds) {
          await ensureBlockInState(Number(childId));
        }
      }
    },
    [blockId, isExpanded, hasChildren, childrenIds]
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
      const ids = [blockId];
      e.dataTransfer.setData(
        `orca/${repoId}`,
        JSON.stringify({ blocks: ids })
      );
      e.dataTransfer.setData("text/plain", ids.join(","));
      e.dataTransfer.effectAllowed = "copyMove";
    },
    [blockId]
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
          onDropOnNode(ids, blockId, currentPos || "inside");
        }
      } catch (err) {
        console.error("[BlockNav] Failed to parse drop data:", err);
      }
    },
    [blockId, onDropOnNode, dropPosition]
  );

  let dropClassName = "";
  if (isDragOver && dropPosition) {
    if (dropPosition === "before") dropClassName = "block-nav-node-drop-before";
    else if (dropPosition === "after") dropClassName = "block-nav-node-drop-after";
    else dropClassName = "block-nav-node-drag-over"; // inside
  }

  // CRITICAL FIX: Early return must be AFTER all hooks!
  // Filter out blocks that don't match and aren't ancestors of a match
  if (isSearching && !isMatched && !isExpandedAncestor) {
    return null;
  }

  if (!block) return null; // Block not loaded yet

  const title = getBlockTitleUtil(block as any, blockId);
  const icon = getBlockIcon(block as any);
  const color = getBlockColor(block as any);

  return (
    <>
      <div
        className={`block-nav-node ${isFocused ? "block-nav-node-selected" : ""} ${dropClassName}`}
        draggable={true}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onDragStart={handleDragStart}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        style={{ paddingLeft: `${depth * 16}px` }}
      >
        <div 
          className="block-nav-node-toggle" 
          style={{ width: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: hasChildren ? 'pointer' : 'default', opacity: hasChildren ? 0.6 : 0 }}
          onClick={hasChildren ? handleToggle : undefined}
        >
          {hasChildren && (
            <i className={`ti ti-chevron-${isExpanded ? 'down' : 'right'}`} style={{ fontSize: '12px' }} />
          )}
        </div>
        <div className="block-nav-node-icon" style={{ marginLeft: '4px', marginRight: '8px', display: 'flex', alignItems: 'center' }}>
          <BlockIcon iconValue={icon} color={color} />
        </div>
        <div className="block-nav-node-content">
          <span className="block-nav-node-title" style={{ color }}>{title}</span>
        </div>
      </div>
      
      {isExpanded && hasChildren && (
        <div className="block-nav-children-container">
          {childrenIds.map((childId) => (
            <BlockNodeItem
              key={Number(childId)}
              blockId={Number(childId)}
              depth={depth + 1}
              focusedBlockId={focusedBlockId}
              onNavigate={onNavigate}
              onRightClick={onRightClick}
              onDropOnNode={onDropOnNode}
            />
          ))}
        </div>
      )}
    </>
  );
};
