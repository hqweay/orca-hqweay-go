import React, { useEffect, useCallback } from "react";
import { useSnapshot } from "valtio";
import { t } from "@/libs/l10n";
import { blockNavState, setRootBlock, searchCache } from "../utils/state";
import {
  getCurrentBlockId,
  getChildBlocks,
  moveBlockToParent,
  getBlockTitle,
  getBlockIconForId,
  getBlockColorForId,
} from "../utils/blocks";
import { useDragDrop } from "../utils/useDragDrop";
import { BlockNodeItem } from "./BlockNodeItem";
import { findMainPanelId, isEditorPanel, getFocusedBlock } from "../utils/nav";
import { BlockIcon } from "../../libs/components/BlockIcon";
import {
  ensureBlockInState,
  getBlockTitle as getBlockTitleUtil,
  findPanelById,
  getRepr,
} from "../../libs/utils";
import { blockNavPluginInstance } from "../index";
import { parseSearchQuery, matchFilters } from "../utils/searchParser";
import styles from "../styles.css?inline";

const CompositionSafeInput: React.FC<any> = (props) => {
  const [isComposing, setIsComposing] = React.useState(false);
  const [localVal, setLocalVal] = React.useState(props.value || "");

  React.useEffect(() => {
    if (!isComposing) {
      setLocalVal(props.value || "");
    }
  }, [props.value, isComposing]);

  return (
    <orca.components.Input
      {...props}
      value={localVal}
      onCompositionStart={(e: any) => {
        setIsComposing(true);
        props.onCompositionStart?.(e);
      }}
      onCompositionEnd={(e: any) => {
        setIsComposing(false);
        props.onCompositionEnd?.(e);
        props.onChange?.(e);
      }}
      onChange={(e: any) => {
        setLocalVal(e.target.value);
        if (!isComposing) {
          props.onChange?.(e);
        }
      }}
    />
  );
};

export const BlockNavPanel: React.FC = () => {
  const state = useSnapshot(blockNavState);
  const orcaState = useSnapshot(orca.state);

  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const parent =
      (containerRef.current.closest(".orca-panel") as HTMLElement) ||
      containerRef.current.parentElement;
    if (!parent) return;

    const wrapper = (parent.closest(".SplitPane") as HTMLElement) || parent;

    const enforceWidth = () => {
      const width = blockNavPluginInstance?.getSettings()?.sidebarWidth || 250;

      const applyStyles = (el: HTMLElement) => {
        const currentFlex = el.style.getPropertyValue("flex");
        const expectedFlex = `0 0 ${width}px`;
        const hasImportant =
          el.style.getPropertyPriority("flex") === "important";

        if (currentFlex !== expectedFlex || !hasImportant) {
          el.style.setProperty("flex", expectedFlex, "important");
          el.style.setProperty("width", `${width}px`, "important");
          el.style.setProperty("min-width", `${width}px`, "important");
          el.style.setProperty("max-width", `${width}px`, "important");
        }
      };

      applyStyles(wrapper);
      if (parent.style) applyStyles(parent);
    };

    enforceWidth();

    const observer = new MutationObserver(() => {
      enforceWidth();
    });

    observer.observe(wrapper, { attributes: true, attributeFilter: ["style"] });
    if (parent !== wrapper) {
      observer.observe(parent, {
        attributes: true,
        attributeFilter: ["style"],
      });
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  const ensureRootChildrenLoaded = useCallback(async (blockId: number) => {
    const block = orca.state.blocks[blockId];
    if (block?.children?.length) {
      await Promise.all(
        block.children.map((childId: string | number) => ensureBlockInState(Number(childId)))
      );
    }
  }, []);

  let currentEditorPanelId = state.lastActiveEditorPanelId;
  if (
    orcaState.activePanel &&
    isEditorPanel(orcaState.panels, orcaState.activePanel)
  ) {
    currentEditorPanelId = orcaState.activePanel;
  } else if (!currentEditorPanelId) {
    currentEditorPanelId = orcaState.activePanel;
  }

  const activeBlockId = getFocusedBlock(orcaState.panels, currentEditorPanelId, state.resolvedJournalBlockIds);

  useEffect(() => {
    const findUnresolvedJournals = (panel: any, unresolved: { key: string, date: any }[]) => {
      if (!panel) return;
      if (panel.view === 'journal' && panel.viewArgs?.date) {
        const date = panel.viewArgs.date;
        const key = typeof date === 'object' && date.getTime 
          ? date.getTime().toString() 
          : String(date);
        
        if (!state.resolvedJournalBlockIds[key]) {
          if (!unresolved.find(u => u.key === key)) {
            unresolved.push({ key, date });
          }
        }
      }
      if (panel.children) {
        for (const child of panel.children) {
          findUnresolvedJournals(child, unresolved);
        }
      }
    };
    
    const unresolved: { key: string, date: any }[] = [];
    findUnresolvedJournals(orcaState.panels, unresolved);
    
    if (unresolved.length > 0) {
      unresolved.forEach(async ({ key, date }) => {
        try {
          // If date is a timestamp string, new Date(Number(date)) might be needed, but usually it's "YYYY-MM-DD" or Date object
          const dateObj = typeof date === 'string' && !isNaN(Number(date)) 
            ? new Date(Number(date)) 
            : typeof date === 'string' 
              ? new Date(date) 
              : date;
              
          const block = await orca.invokeBackend("get-journal-block", dateObj);
          if (block && block.id) {
            blockNavState.resolvedJournalBlockIds[key] = block.id;
          }
        } catch (e) {
          console.error("[BlockNav] Failed to resolve journal block for date:", date, e);
        }
      });
    }
  }, [orcaState.panels]);

  useEffect(() => {
    if (!activeBlockId) return;

    const resolveAndLoad = async () => {
      // 1. Check if the newly focused block is a descendant of the current sidebar root.
      // Only keep the sidebar stable if the navigation was triggered from the sidebar!
      if (
        blockNavState.rootBlockId &&
        activeBlockId === blockNavState.navigatedToBlockId
      ) {
        let isDescendant = false;
        let currentId: number | null = activeBlockId;
        const visited = new Set<number>();
        
        while (currentId) {
          if (visited.has(currentId)) break; // Prevent infinite loop
          visited.add(currentId);
          
          if (currentId === blockNavState.rootBlockId) {
            isDescendant = true;
            break;
          }
          let currentBlock: any = orca.state.blocks[currentId];
          if (!currentBlock) {
            await ensureBlockInState(currentId);
            currentBlock = orca.state.blocks[currentId];
          }
          if (!currentBlock || !currentBlock.parent) {
            break;
          }
          currentId = Number(currentBlock.parent);
        }

        // Keep sidebar stable and exit early!
        if (isDescendant) return;
      }

      // 2. If it's a completely new context (or zooming OUT of the current tree), reset the root.
      let block = orca.state.blocks[activeBlockId!];
      if (!block) {
        await ensureBlockInState(activeBlockId!);
        block = orca.state.blocks[activeBlockId!];
      }
      if (block && block.parent) {
        const parentId = Number(block.parent);
        if (parentId !== blockNavState.rootBlockId) {
          setRootBlock(parentId);
          await ensureRootChildrenLoaded(parentId);
        }
      } else {
        if (activeBlockId !== blockNavState.rootBlockId) {
          setRootBlock(activeBlockId);
          await ensureRootChildrenLoaded(activeBlockId);
        }
      }
    };

    resolveAndLoad();
  }, [activeBlockId, ensureRootChildrenLoaded]);

  useEffect(() => {
    if (
      orcaState.activePanel &&
      isEditorPanel(orcaState.panels, orcaState.activePanel)
    ) {
      blockNavState.lastActiveEditorPanelId = orcaState.activePanel;
    }
  }, [orcaState.activePanel]);

  const rootBlockChildrenHash = React.useMemo(() => {
    return state.rootBlockId
      ? orcaState.blocks[state.rootBlockId]?.children?.join(",")
      : undefined;
  }, [state.rootBlockId, state.rootBlockId ? orcaState.blocks[state.rootBlockId as number]?.children : undefined]);

  useEffect(() => {
    if (state.rootBlockId) {
      ensureRootChildrenLoaded(state.rootBlockId);
    }
  }, [state.rootBlockId, rootBlockChildrenHash, ensureRootChildrenLoaded]);

  const ensureEditorFocus = async (targetBlockId: number) => {
    let editorPanelId = state.lastActiveEditorPanelId;
    if (!editorPanelId || !isEditorPanel(orca.state.panels, editorPanelId)) {
      editorPanelId = findMainPanelId(
        orca.state.panels,
        orca.state.activePanel,
      );
    }

    if (editorPanelId) {
      orca.nav.switchFocusTo(editorPanelId);
    } else {
      // Fallback: No editor exists, force open one so editor commands can run
      orca.nav.goTo("block", { blockId: targetBlockId });
      await new Promise((r) => setTimeout(r, 500));
    }
  };

  const handleDrop = useCallback(
    async (blockIds: number[]) => {
      if (!state.rootBlockId) return;
      if (blockIds.length > 0) {
        await ensureEditorFocus(blockIds[0]);
      }

      for (const id of blockIds) {
        await ensureBlockInState(id);
        await ensureBlockInState(state.rootBlockId);
        await moveBlockToParent(id, state.rootBlockId);
      }
      await ensureRootChildrenLoaded(state.rootBlockId);
    },
    [
      state.rootBlockId,
      state.lastActiveEditorPanelId,
      ensureRootChildrenLoaded,
    ],
  );

  const handleDropOnNode = useCallback(
    async (
      blockIds: number[],
      targetId: number,
      position: "before" | "after" | "inside",
    ) => {
      if (blockIds.length > 0) {
        await ensureEditorFocus(blockIds[0]);
      }

      for (const id of blockIds) {
        if (id === targetId) continue;
        await ensureBlockInState(id);
        await ensureBlockInState(targetId);
        if (position === "inside") {
          await moveBlockToParent(id, targetId);
        } else {
          await orca.commands.invokeEditorCommand(
            "core.editor.moveBlocks",
            null,
            [id],
            targetId,
            position,
          );
        }
      }
      if (state.rootBlockId) {
        await ensureRootChildrenLoaded(state.rootBlockId);
      }
    },
    [state.rootBlockId, ensureRootChildrenLoaded],
  );

  const executeNavigation = useCallback(
    (blockId: number, mode: "scroll" | "zoom" | "zoom-editor-only") => {
      blockNavState.navigatedToBlockId = blockId;
      const activeEditor =
        state.lastActiveEditorPanelId || orcaState.activePanel;
      const mainPanelId = findMainPanelId(orca.state.panels, activeEditor);
      if (mainPanelId) {
        if (mode === "zoom" || mode === "zoom-editor-only") {
          orca.nav.goTo("block", { blockId }, mainPanelId);
          orca.nav.switchFocusTo(mainPanelId);
        } else {
          setTimeout(() => {
            const panel = findPanelById(orca.state.panels, mainPanelId);
            if (panel?.viewState?.editor?.positionBlock) {
              panel.viewState.editor.positionBlock(blockId);
            }
          }, 50);
        }
      } else {
        const sidebarPanelId = orca.state.activePanel;
        orca.nav.addTo(sidebarPanelId, "right", {
          view: "block",
          viewArgs: { blockId },
          viewState: {},
        });
      }
    },
    [state.lastActiveEditorPanelId, orcaState.activePanel],
  );

  const handleNavigate = useCallback(
    (blockId: number, altKey?: boolean) => {
      executeNavigation(blockId, altKey ? "zoom-editor-only" : "scroll");
    },
    [executeNavigation],
  );

  const handleRightClick = useCallback(
    (blockId: number) => {
      setRootBlock(blockId);
      executeNavigation(blockId, "zoom");
    },
    [executeNavigation],
  );

  const handleSearch = useCallback(async (text: string) => {
    blockNavState.filterText = text;
    const parsed = parseSearchQuery(text);
    
    // If no raw text and no filters, exit search mode
    if (!parsed.rawText && parsed.filters.length === 0) {
      blockNavState.isSearching = false;
      blockNavState.searchMatchedIds = {};
      blockNavState.searchExpandedIds = {};
      return;
    }

    if (!blockNavState.rootBlockId) {
      return;
    }
    blockNavState.isSearching = true;

    let blockTree = searchCache.tree;

    if (
      !blockTree ||
      !Array.isArray(blockTree) ||
      searchCache.rootId !== blockNavState.rootBlockId
    ) {
      try {
        blockTree = await orca.invokeBackend(
          "get-block-tree",
          blockNavState.rootBlockId,
        );
        
        if (!blockTree || !Array.isArray(blockTree)) return;
        
        searchCache.tree = blockTree;
        searchCache.rootId = blockNavState.rootBlockId;
        searchCache.map.clear();
        for (const b of blockTree) {
          searchCache.map.set(b.id, b);
        }
      } catch (e) {
        console.error("Failed to fetch block tree", e);
        return;
      }
    }

    const matchedIds: Record<number, boolean> = {};
    const expandedIds: Record<number, boolean> = {};
    const lowerText = parsed.rawText.toLowerCase();

    for (const cachedBlock of blockTree) {
      // Use live block state if available, ensuring edits from the main editor 
      // are accurately reflected during search without refetching the entire tree.
      const block = orca.state.blocks[cachedBlock.id] || cachedBlock;

      let blockText = "";
      try {
        const title = getBlockTitleUtil(block, block.id, 0);
        if (typeof title === "string") {
          blockText = title.toLowerCase();
        }
      } catch (e) {
        // Ignore extraction errors
      }

      const textMatched = !lowerText || blockText.includes(lowerText);
      const filterMatched = matchFilters(block, parsed.filters, getRepr);

      if (textMatched && filterMatched) {
        matchedIds[block.id] = true;

        let current = block.parent;
        let loopCount = 0;
        while (current && searchCache.map.has(Number(current))) {
          loopCount++;
          if (loopCount > 1000) {
             console.error("[BlockNavSearch] FATAL: infinite loop detected during parent traversal!");
             break;
          }
          const currentId = Number(current);
          if (expandedIds[currentId]) break; // Already expanded this path, or hit a circular reference!
          
          expandedIds[currentId] = true;
          current = searchCache.map.get(currentId).parent;
          
          // Absolute safeguard against node pointing to itself
          if (current == currentId) break; 
        }
      }
    }

    try {
      blockNavState.searchMatchedIds = matchedIds;
      blockNavState.searchExpandedIds = expandedIds;
    } catch (e) {
      console.error("[BlockNavSearch] CRASH while assigning proxy!", e);
    }
  }, []);

  useEffect(() => {
    if (state.searchTrigger > 0) {
      handleSearch(state.filterText);
    }
  }, [state.searchTrigger, state.filterText, handleSearch]);

  const { isDragOver, dragHandlers } = useDragDrop({ onDrop: handleDrop });

  const focusedBlockId = getFocusedBlock(
    orcaState.panels,
    state.lastActiveEditorPanelId || orcaState.activePanel,
  );

  const rootBlock = state.rootBlockId
    ? orcaState.blocks[state.rootBlockId]
    : null;
  const childrenIds = rootBlock?.children || [];
  const hasItems = childrenIds.length > 0;

  const parentId = rootBlock?.parent ? Number(rootBlock.parent) : null;

  return (
    <div
      ref={containerRef}
      className={`block-nav-panel ${isDragOver ? "block-nav-panel-drag-over" : ""}`}
      {...dragHandlers}
    >
      <style dangerouslySetInnerHTML={{ __html: styles }} />

      <div
        className="block-nav-header"
        style={{
          display: "flex",
          flexDirection: "column",
          padding: "8px 12px",
          borderBottom: "1px solid var(--orca-border)",
          gap: "8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
          {parentId && (
            <div
              style={{
                cursor: "pointer",
                opacity: 0.6,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "4px",
                borderRadius: "4px",
                flexShrink: 0,
              }}
              className="hover-bg"
              onClick={(e) => {
                e.stopPropagation();
                setRootBlock(parentId);
                executeNavigation(parentId, "zoom");
              }}
            >
              <i className="ti ti-arrow-up" />
            </div>
          )}
          <div
            className="block-nav-header-title"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: state.rootBlockId
                ? getBlockColorForId(state.rootBlockId)
                : undefined,
              cursor: state.rootBlockId ? "pointer" : "default",
              flex: 1,
              overflow: "hidden",
            }}
            onClick={(e) => {
              if (state.rootBlockId) {
                handleNavigate(state.rootBlockId, e.altKey || e.metaKey);
              }
            }}
          >
            {state.rootBlockId ? (
              <>
                <BlockIcon
                  iconValue={getBlockIconForId(state.rootBlockId)}
                  color={getBlockColorForId(state.rootBlockId)}
                />
                <span
                  title={getBlockTitle(state.rootBlockId, 0)}
                  style={{
                    fontWeight: 600,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {getBlockTitle(state.rootBlockId, 0)}
                </span>
              </>
            ) : (
              t("block-nav.no-block")
            )}
          </div>
        </div>

        {state.rootBlockId && (
          <div style={{ width: "100%" }}>
            <CompositionSafeInput
              value={state.filterText}
              onChange={(e: any) => handleSearch(e.target.value)}
              placeholder="Filter..."
              pre={<i className="ti ti-search" style={{ opacity: 0.6 }} />}
              post={
                state.filterText ? (
                  <div
                    className="hover-bg"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      padding: "2px",
                      borderRadius: "4px",
                      opacity: 0.6,
                    }}
                    onMouseDown={(e: React.MouseEvent) => {
                      e.preventDefault(); // Prevent losing focus
                      handleSearch("");
                    }}
                  >
                    <i className="ti ti-x" />
                  </div>
                ) : undefined
              }
            />
            <div style={{ display: "flex", gap: "6px", marginTop: "8px", flexWrap: "wrap", padding: "0 2px" }}>
              {(() => {
                const parsed = parseSearchQuery(state.filterText);
                
                const toggleFilter = (filterKey: string) => {
                  let newFilters = [...parsed.filters];
                  if (newFilters.includes(filterKey)) {
                    newFilters = newFilters.filter(f => f !== filterKey);
                  } else {
                    newFilters.push(filterKey);
                  }
                  const newText = [
                    ...newFilters.map(f => `is:${f}`),
                    parsed.rawText
                  ].filter(Boolean).join(" ");
                  handleSearch(newText);
                };

                const getChipStyle = (isActive: boolean) => ({
                  fontSize: "12px",
                  padding: "2px 8px",
                  borderRadius: "12px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  userSelect: "none" as const,
                  backgroundColor: isActive ? "var(--b3-theme-primary)" : "transparent",
                  color: isActive ? "var(--b3-theme-on-primary)" : "var(--b3-theme-on-surface)",
                  border: `1px solid ${isActive ? "var(--b3-theme-primary)" : "var(--b3-border-color)"}`,
                  opacity: isActive ? 1 : 0.8
                });

                return (
                  <>
                    <div
                      onClick={() => toggleFilter("heading")}
                      style={getChipStyle(parsed.filters.includes("heading"))}
                    >
                      <i className="ti ti-heading" /> {t("block-nav.filter-heading") || "标题"}
                    </div>
                    <div
                      onClick={() => toggleFilter("todo")}
                      style={getChipStyle(parsed.filters.includes("todo"))}
                    >
                      <i className="ti ti-square" /> {t("block-nav.filter-todo") || "待办"}
                    </div>
                    <div
                      onClick={() => toggleFilter("done")}
                      style={getChipStyle(parsed.filters.includes("done"))}
                    >
                      <i className="ti ti-checkbox" /> {t("block-nav.filter-done") || "已办"}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      <div className="block-nav-content">
        {!hasItems ? (
          <div className="block-nav-empty">
            {isDragOver ? (
              <>
                <i className="ti ti-download" />
                <div>{t("block-nav.drop-to-add")}</div>
              </>
            ) : (
              <>
                <i className="ti ti-tree" />
                <div>{t("block-nav.no-children")}</div>
              </>
            )}
          </div>
        ) : (
          childrenIds.map((childId) => (
            <BlockNodeItem
              key={Number(childId)}
              blockId={Number(childId)}
              depth={0}
              focusedBlockId={focusedBlockId}
              onNavigate={handleNavigate}
              onRightClick={handleRightClick}
              onDropOnNode={handleDropOnNode}
            />
          ))
        )}
      </div>

      {isDragOver && hasItems && (
        <div className="block-nav-drop-hint">
          <i className="ti ti-plus" /> {t("block-nav.drop-to-add")}
        </div>
      )}
    </div>
  );
};
