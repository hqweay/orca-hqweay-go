import React, { useCallback, useEffect } from "react";
import { useSnapshot } from "valtio";
import {
  blockNavState,
  toggleNodeExpansion,
  searchCache,
} from "../utils/state";
import { findMainPanelId } from "../utils/nav";
import { getConvertedRepr } from "../utils/blocks";
import { findPanelById } from "../../libs/utils";
import { BlockIcon } from "../../libs/components/BlockIcon";
import {
  getBlockTitle as getBlockTitleUtil,
  getBlockIcon,
  getBlockColor,
  ensureBlockInState,
  getRepr,
} from "../../libs/utils";
import { t } from "../../libs/l10n";

interface BlockNodeItemProps {
  blockId: number;
  depth: number;
  focusedBlockId: number | null;
  onNavigate: (blockId: number, altKey: boolean) => void;
  onRightClick: (blockId: number) => void;
  onDropOnNode: (
    blockIds: number[],
    targetId: number,
    position: "before" | "after" | "inside",
  ) => void;
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

  // Use stateBlock if available since it is reactive, fallback to searchCache
  const blocksSnap = useSnapshot(orca.state.blocks);
  const stateBlock = blocksSnap[blockId];
  const block =
    stateBlock || (isSearching ? searchCache.map.get(blockId) : undefined);

  const searchRegex = React.useMemo(() => {
    if (!state.filterText.trim()) return null;
    const safeFilter = state.filterText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(${safeFilter})`, "gi");
  }, [state.filterText]);

  const isMatched = isSearching ? !!state.searchMatchedIds[blockId] : false;
  const isExpandedAncestor = isSearching
    ? !!state.searchExpandedIds[blockId]
    : false;

  const isExpanded = isSearching
    ? isExpandedAncestor
    : !!state.expandedIds[blockId];

  const isFocused = blockId === focusedBlockId;
  const childrenIds = block?.children || [];
  // When searching, if a node is matched but isn't an ancestor to other matches, we don't need to expand it to show its children
  const hasChildren =
    childrenIds.length > 0 && (!isSearching || isExpandedAncestor);

  const [isDragOver, setIsDragOver] = React.useState(false);
  const dragCounter = React.useRef(0);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onNavigate(blockId, e.altKey || e.metaKey);
    },
    [blockId, onNavigate],
  );

  const handleSetHeading = useCallback(
    async (level: number) => {
      // Find the main editor panel reliably
      let mainPanelId = findMainPanelId(
        orca.state.panels,
        state.lastActiveEditorPanelId || orca.state.activePanel,
      );

      if (mainPanelId) {
        // Switch focus to the editor panel without triggering a route navigation
        orca.nav.switchFocusTo(mainPanelId);
        
        // CRITICAL: We MUST position the block before conversion, otherwise 
        // the virtual list might not have it rendered, causing setProperties to fail!
        const mainPanel = findPanelById(orca.state.panels, mainPanelId);
        if (mainPanel?.viewState?.editor?.positionBlock) {
          mainPanel.viewState.editor.positionBlock(blockId);
          await new Promise((r) => setTimeout(r, 50));
        }
      } else {
        // Ultimate fallback if no editor panel is open
        orca.nav.goTo("block", { blockId });
        await new Promise((r) => setTimeout(r, 150));
      }

      const blk = await ensureBlockInState(blockId);
      if (!blk) return;
      const newRep = getConvertedRepr(blk, level);

      // 1. Instantly update the local search cache AND live state so UI and filters react immediately.
      // We must update the `properties` array specifically because `matchFilters` uses `getRepr` 
      // which searches inside `block.properties`.
      const updateBlockProps = (b: any) => {
        if (!b) return;
        b._repr = newRep;
        if (!b.properties) b.properties = [];
        const propIndex = b.properties.findIndex((p: any) => p.name === "_repr");
        if (propIndex >= 0) b.properties[propIndex].value = newRep;
        else b.properties.push({ name: "_repr", value: newRep, type: 0 });
      };

      updateBlockProps(searchCache.map.get(blockId));
      updateBlockProps(orca.state.blocks[blockId]);
      
      // 2. If user is currently searching, trigger a fast re-evaluation of the tree
      if (state.filterText) {
        blockNavState.searchTrigger++;
      }

      await orca.commands.invokeEditorCommand(
        "core.editor.setProperties",
        null,
        [blockId],
        [{ name: "_repr", value: newRep, type: 0 }],
      );



      // Wait for React to re-render the block with the new properties, then scroll to it
      setTimeout(() => {
        onNavigate(blockId, false);
      }, 150);
    },
    [blockId],
  );

  const handleToggle = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      toggleNodeExpansion(blockId);

      // If we are expanding, ensure children are loaded in memory
      if (!isExpanded && hasChildren) {
        await Promise.all(
          childrenIds.map((childId: string | number) =>
            ensureBlockInState(Number(childId)),
          ),
        );
      }
    },
    [blockId, isExpanded, hasChildren, childrenIds],
  );

  const [dropPosition, setDropPosition] = React.useState<
    "before" | "after" | "inside" | null
  >(null);

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
      e.dataTransfer.setData(`orca/${repoId}`, JSON.stringify({ blocks: ids }));
      e.dataTransfer.setData("text/plain", ids.join(","));
      e.dataTransfer.effectAllowed = "copyMove";
    },
    [blockId],
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
    [blockId, onDropOnNode, dropPosition],
  );

  let dropClassName = "";
  if (isDragOver && dropPosition) {
    if (dropPosition === "before") dropClassName = "block-nav-node-drop-before";
    else if (dropPosition === "after")
      dropClassName = "block-nav-node-drop-after";
    else dropClassName = "block-nav-node-drag-over"; // inside
  }

  // CRITICAL FIX: Early return must be AFTER all hooks!
  // Filter out blocks that don't match and aren't ancestors of a match
  if (isSearching && !isMatched && !isExpandedAncestor) {
    return null;
  }

  if (!block) return null; // Block not loaded yet

  const title = getBlockTitleUtil(block as any, blockId, 0);
  const icon = getBlockIcon(block as any);
  const color = getBlockColor(block as any);

  const renderHighlightedTitle = (text: string) => {
    if (!searchRegex || !text) return text;

    const parts = text.split(searchRegex);
    const lowerFilter = state.filterText.toLowerCase();

    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === lowerFilter ? (
            <mark
              key={i}
              style={{
                backgroundColor: "rgba(255, 212, 0, 0.4)",
                color: "inherit",
                borderRadius: "2px",
                padding: "0 2px",
              }}
            >
              {part}
            </mark>
          ) : (
            <span key={i}>{part}</span>
          ),
        )}
      </>
    );
  };

  const isHeading = getRepr(block || {})?.type === "heading";

  return (
    <>
      <orca.components.ContextMenu
        menu={(closeMenu) => (
          <orca.components.Menu>
            {isHeading ? (
              <orca.components.MenuText
                preIcon="ti ti-clear-formatting"
                title={t("block-nav.make-text") || "转为普通文本"}
                onClick={() => {
                  closeMenu();
                  handleSetHeading(0);
                }}
              />
            ) : (
              <orca.components.MenuText
                preIcon="ti ti-heading"
                title={t("block-nav.make-auto-heading") || "转为自动标题"}
                onClick={() => {
                  closeMenu();
                  handleSetHeading(-1);
                }}
              />
            )}
          </orca.components.Menu>
        )}
      >
        {(openMenu, closeMenu) => (
          <div
            className={`block-nav-node ${isFocused ? "block-nav-node-selected" : ""} ${dropClassName}`}
            draggable={true}
            onContextMenu={openMenu as any}
            onDragStart={handleDragStart}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            style={{ paddingLeft: `${depth * 16}px` }}
          >
            <div
              className="block-nav-node-toggle"
              style={{
                width: "16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: hasChildren ? "pointer" : "default",
                opacity: hasChildren ? 0.6 : 0,
              }}
              onClick={hasChildren ? handleToggle : undefined}
            >
              {hasChildren && (
                <i
                  className={`ti ti-chevron-${isExpanded ? "down" : "right"}`}
                  style={{ fontSize: "12px" }}
                />
              )}
            </div>
            <div
              className="block-nav-node-icon-container"
              style={{
                marginLeft: "4px",
                marginRight: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                width: "16px",
                height: "16px",
              }}
              onClick={(e) => {
                e.stopPropagation();
                onRightClick(blockId);
              }}
              title={t("block-nav.zoom-in") || "聚焦"}
            >
              <div
                className="icon-default"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "100%",
                  height: "100%",
                }}
              >
                <BlockIcon iconValue={icon} color={color} />
              </div>
              <div
                className="icon-hover"
                style={{
                  display: "none",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--b3-theme-primary)",
                  fontSize: "14px",
                  width: "100%",
                  height: "100%",
                }}
              >
                <i className="ti ti-focus-centered" />
              </div>
            </div>
            <div className="block-nav-node-content" onClick={handleClick}>
              <span
                className="block-nav-node-title"
                style={{ color }}
                title={title as string}
              >
                {isSearching && isMatched
                  ? renderHighlightedTitle(title as string)
                  : title}
              </span>
            </div>
          </div>
        )}
      </orca.components.ContextMenu>

      {isExpanded && hasChildren && (
        <div className="block-nav-children-container">
          {childrenIds.map((childId: string) => (
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
