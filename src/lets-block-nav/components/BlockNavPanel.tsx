import React, { useEffect, useCallback, useState, useRef } from "react";
import { useSnapshot } from "valtio";
import { t } from "@/libs/l10n";
import applyCSSRule, { removeCSSRule } from "@/libs/styleUtil";
import { blockNavState, setRootBlock, searchCache } from "../utils/state";
import {
  getCurrentBlockId,
  getChildBlocks,
  moveBlockToParent,
  getBlockTitle,
  getBlockIconForId,
  getBlockColorForId,
} from "../utils/blocks";
import { executeSnapshotExpand } from "../utils/state";
import { executeEditorExpand } from "../../lets-editor-fold/logic";
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
import { blockNavPluginInstance, TOC_CSS_ID } from "../index";
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
    if (state.hideBuiltInToc) {
      applyCSSRule(
        `
        .orca-toc { display: none !important; }
        .orca-block-editor-sidetools-btn:has(.ti-align-justified) { display: none !important; }
      `,
        { id: TOC_CSS_ID },
      );
    }

    return () => {
      removeCSSRule(TOC_CSS_ID);
    };
  }, [state.hideBuiltInToc]);

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
        block.children.map((childId: string | number) =>
          ensureBlockInState(Number(childId)),
        ),
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

  const activeBlockId = getFocusedBlock(
    orcaState.panels,
    currentEditorPanelId,
    state.resolvedJournalBlockIds,
  );

  useEffect(() => {
    const findUnresolvedJournals = (
      panel: any,
      unresolved: { key: string; date: any }[],
    ) => {
      if (!panel) return;
      if (panel.view === "journal" && panel.viewArgs?.date) {
        const date = panel.viewArgs.date;
        const key =
          typeof date === "object" && date.getTime
            ? date.getTime().toString()
            : String(date);

        if (!state.resolvedJournalBlockIds[key]) {
          if (!unresolved.find((u) => u.key === key)) {
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

    const unresolved: { key: string; date: any }[] = [];
    findUnresolvedJournals(orcaState.panels, unresolved);

    if (unresolved.length > 0) {
      unresolved.forEach(async ({ key, date }) => {
        try {
          // If date is a timestamp string, new Date(Number(date)) might be needed, but usually it's "YYYY-MM-DD" or Date object
          const dateObj =
            typeof date === "string" && !isNaN(Number(date))
              ? new Date(Number(date))
              : typeof date === "string"
                ? new Date(date)
                : date;

          const block = await orca.invokeBackend("get-journal-block", dateObj);
          if (block && block.id) {
            blockNavState.resolvedJournalBlockIds[key] = block.id;
          }
        } catch (e) {
          console.error(
            "[BlockNav] Failed to resolve journal block for date:",
            date,
            e,
          );
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
  }, [
    state.rootBlockId,
    state.rootBlockId
      ? orcaState.blocks[state.rootBlockId as number]?.children
      : undefined,
  ]);

  useEffect(() => {
    if (state.rootBlockId) {
      ensureRootChildrenLoaded(state.rootBlockId);

      let canceled = false;
      const fetchAndCalc = async () => {
        let tree = searchCache.tree;
        if (!tree || searchCache.rootId !== state.rootBlockId) {
          try {
            tree = await orca.invokeBackend(
              "get-block-tree",
              state.rootBlockId,
            );
            if (canceled) return;
            if (tree && Array.isArray(tree)) {
              searchCache.tree = tree;
              searchCache.rootId = state.rootBlockId;
              searchCache.map.clear();
              for (const b of tree) {
                searchCache.map.set(b.id, b);
              }
            }
          } catch (e) {
            console.error("Failed to fetch block tree for depth calc", e);
            return;
          }
        }

        if (canceled) return;
      };
      fetchAndCalc();

      return () => {
        canceled = true;
      };
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
              // Determine if the clicked block is actually rendered in the current editor view.
              let isDescendant = false;
              if (panel.view === "journal" && panel.viewArgs?.date) {
                isDescendant = true;
              } else if (panel.viewArgs?.blockId) {
                const currentEditorRootId = Number(panel.viewArgs.blockId);
                let curr: any = orca.state.blocks[blockId];
                while (curr) {
                  if (Number(curr.id) === currentEditorRootId) {
                    isDescendant = true;
                    break;
                  }
                  if (!curr.parent) break;
                  curr = orca.state.blocks[Number(curr.parent)];
                }
              } else {
                isDescendant = true;
              }

              if (!isDescendant) {
                // The target block is outside the editor's current view.
                orca.nav.goTo("block", { blockId }, mainPanelId);
                orca.nav.switchFocusTo(mainPanelId);
              } else {
                let targetId = blockId;
                if (blockId === blockNavState.rootBlockId) {
                  const docBlock = orca.state.blocks[blockId];
                  if (docBlock?.children && docBlock.children.length > 0) {
                    targetId = Number(docBlock.children[0]);
                  }
                }
                panel.viewState.editor.positionBlock(targetId);
              }
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
            console.error(
              "[BlockNavSearch] FATAL: infinite loop detected during parent traversal!",
            );
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

          {state.rootBlockId && hasItems && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "2px",
                marginLeft: "auto",
                fontSize: "11px",
                color: "var(--orca-color-text-3)",
              }}
            >
              {([1, 2, 3, "All"] as const).map((level) => (
                <div
                  key={level}
                  className="hover-bg block-nav-depth-btn"
                  style={{
                    padding: "2px 6px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    executeSnapshotExpand(level);
                  }}
                  onContextMenu={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const el = e.currentTarget;
                    el.classList.add("right-click-active");
                    setTimeout(() => el.classList.remove("right-click-active"), 150);

                    if (state.rootBlockId) {
                      // 聚焦回主编辑器，否则侧边栏会吞掉编辑器命令的上下文
                      await ensureEditorFocus(state.rootBlockId);
                      
                      setTimeout(async () => {
                        if (level === "All") {
                          await orca.commands.invokeEditorCommand("core.editor.unfoldAll", null);
                        } else {
                          await executeEditorExpand(
                            level,
                            state.rootBlockId!,
                            console
                          );
                        }
                      }, 50);
                    }
                  }}
                  title={
                    level === "All"
                      ? t("block-nav.expand-all") || "Expand All"
                      : `${t("block-nav.expand-to") || "Expand to L"}${level}\n(Right click to expand Editor)`
                  }
                >
                  {level}
                </div>
              ))}
            </div>
          )}
        </div>

        {state.rootBlockId && (
          <div style={{ width: "100%" }}>
            <FilterInput
              filterText={state.filterText}
              onSearch={handleSearch}
            />
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

// ─── Filter Input with Dropdown ──────────────────────────────────────────────

const FILTER_OPTIONS = [
  { key: "heading", icon: "ti ti-heading", label: "标题" },
  { key: "todo", icon: "ti ti-square", label: "待办" },
  { key: "done", icon: "ti ti-checkbox", label: "已办" },
  { key: "image", icon: "ti ti-photo", label: "图片" },
];

const FilterInput: React.FC<{
  filterText: string;
  onSearch: (text: string) => void;
}> = ({ filterText, onSearch }) => {
  const parsed = parseSearchQuery(filterText);
  const hasActiveFilters = parsed.filters.length > 0;

  const toggleFilter = (filterKey: string) => {
    let newFilters = [...parsed.filters];
    if (newFilters.includes(filterKey)) {
      newFilters = newFilters.filter((f) => f !== filterKey);
    } else {
      newFilters.push(filterKey);
    }
    const newText = [...newFilters.map((f) => `is:${f}`), parsed.rawText]
      .filter(Boolean)
      .join(" ");
    onSearch(newText);
  };

  const clearAllFilters = () => {
    onSearch(parsed.rawText);
  };

  return (
    <div style={{ position: "relative" }}>
      {/* Search Input */}
      <div>
        <CompositionSafeInput
          value={filterText}
          onChange={(e: any) => onSearch(e.target.value)}
          placeholder="Filter..."
          pre={
            <orca.components.ContextMenu
              menu={(closeMenu) => (
                <orca.components.Menu>
                  {FILTER_OPTIONS.map((option) => {
                    const isActive = parsed.filters.includes(option.key);
                    return (
                      <orca.components.MenuText
                        key={option.key}
                        preIcon={option.icon}
                        title={option.label}
                        postIcon={isActive ? "ti ti-check" : undefined}
                        style={
                          isActive
                            ? {
                                backgroundColor: "var(--orca-color-primary-1)",
                                color: "var(--orca-color-primary-5)",
                              }
                            : {}
                        }
                        onClick={() => {
                          toggleFilter(option.key);
                          // We don't necessarily close the menu so they can toggle multiple
                        }}
                      />
                    );
                  })}
                </orca.components.Menu>
              )}
            >
              {(openMenu) => (
                <div
                  className="hover-bg"
                  onMouseDown={(e: React.MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openMenu(e);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    borderRadius: "4px",
                    color: hasActiveFilters
                      ? "var(--orca-color-primary-5)"
                      : "inherit",
                    opacity: hasActiveFilters ? 1 : 0.6,
                    width: "24px",
                    height: "24px",
                  }}
                  title="Filter"
                >
                  <i className="ti ti-filter" />
                </div>
              )}
            </orca.components.ContextMenu>
          }
          post={
            <div
              className="hover-bg"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: filterText ? "pointer" : "default",
                borderRadius: "4px",
                opacity: filterText ? 0.6 : 0,
                pointerEvents: filterText ? "auto" : "none",
                width: "24px",
                height: "24px",
              }}
              onMouseDown={(e: React.MouseEvent) => {
                if (filterText) {
                  e.preventDefault();
                  onSearch("");
                }
              }}
            >
              <i className="ti ti-x" />
            </div>
          }
        />
      </div>

      {/* Active Filter Chips (only when filters are active) */}
      {hasActiveFilters && (
        <div
          style={{
            display: "flex",
            gap: "4px",
            marginTop: "6px",
            flexWrap: "wrap",
          }}
        >
          {parsed.filters.map((filterKey) => {
            const option = FILTER_OPTIONS.find((o) => o.key === filterKey);
            if (!option) return null;
            return (
              <div
                key={filterKey}
                style={{
                  fontSize: "11px",
                  padding: "2px 6px",
                  borderRadius: "10px",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  backgroundColor: "var(--orca-color-primary-1)",
                  color: "var(--orca-color-primary-5)",
                  cursor: "pointer",
                }}
                onClick={() => toggleFilter(filterKey)}
                title={`Click to remove: ${option.label}`}
              >
                <i className={option.icon} style={{ fontSize: "10px" }} />
                {option.label}
                <i
                  className="ti ti-x"
                  style={{ fontSize: "10px", opacity: 0.6 }}
                />
              </div>
            );
          })}
          {parsed.filters.length > 1 && (
            <div
              style={{
                fontSize: "11px",
                padding: "2px 6px",
                borderRadius: "10px",
                cursor: "pointer",
                color: "var(--orca-color-text-3)",
              }}
              onClick={clearAllFilters}
              title={t("block-nav.clear-filters") || "清空"}
            >
              {t("block-nav.clear-filters") || "清空"}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
