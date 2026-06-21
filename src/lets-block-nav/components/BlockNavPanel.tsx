import React, { useEffect, useCallback } from "react";
import { useSnapshot } from "valtio";
import { t } from "@/libs/l10n";
import {
  blockNavState,
  setRootBlock,
} from "../utils/state";
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
import { ensureBlockInState } from "../../libs/utils";
import styles from "../styles.css?inline";

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
      const width = 250;

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
      for (const childId of block.children) {
        await ensureBlockInState(Number(childId));
      }
    }
  }, []);

  let currentEditorPanelId = state.lastActiveEditorPanelId;
  if (orcaState.activePanel && isEditorPanel(orcaState.panels, orcaState.activePanel)) {
    currentEditorPanelId = orcaState.activePanel;
  } else if (!currentEditorPanelId) {
    currentEditorPanelId = orcaState.activePanel;
  }

  const activeBlockId = getFocusedBlock(orcaState.panels, currentEditorPanelId);

  useEffect(() => {
    if (!activeBlockId) return;

    const resolveAndLoad = async () => {
      // 1. Check if the newly focused block is a descendant of the current sidebar root.
      // Only keep the sidebar stable if the navigation was triggered from the sidebar!
      if (blockNavState.rootBlockId && activeBlockId === blockNavState.navigatedToBlockId) {
        let isDescendant = false;
        let currentId: number | null = activeBlockId;
        while (currentId) {
          if (currentId === blockNavState.rootBlockId) {
            isDescendant = true;
            break;
          }
          let currentBlock = orca.state.blocks[currentId];
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
    if (orcaState.activePanel && isEditorPanel(orcaState.panels, orcaState.activePanel)) {
      blockNavState.lastActiveEditorPanelId = orcaState.activePanel;
    }
  }, [orcaState.activePanel]);

  const rootBlockChildrenHash = state.rootBlockId 
    ? orcaState.blocks[state.rootBlockId]?.children?.join(',') 
    : undefined;

  useEffect(() => {
    if (state.rootBlockId) {
      ensureRootChildrenLoaded(state.rootBlockId);
    }
  }, [state.rootBlockId, rootBlockChildrenHash, ensureRootChildrenLoaded]);

  const ensureEditorFocus = async (targetBlockId: number) => {
    let editorPanelId = state.lastActiveEditorPanelId;
    if (!editorPanelId || !isEditorPanel(orca.state.panels, editorPanelId)) {
      editorPanelId = findMainPanelId(orca.state.panels, orca.state.activePanel);
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
    [state.rootBlockId, state.lastActiveEditorPanelId, ensureRootChildrenLoaded]
  );

  const handleDropOnNode = useCallback(
    async (blockIds: number[], targetId: number, position: "before" | "after" | "inside") => {
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
            position
          );
        }
      }
      if (state.rootBlockId) {
        await ensureRootChildrenLoaded(state.rootBlockId);
      }
    },
    [state.rootBlockId, ensureRootChildrenLoaded]
  );

  const handleNavigate = useCallback((blockId: number) => {
    blockNavState.navigatedToBlockId = blockId;
    const activeEditor = state.lastActiveEditorPanelId || orcaState.activePanel;
    const mainPanelId = findMainPanelId(orca.state.panels, activeEditor);
    if (mainPanelId) {
      orca.nav.goTo("block", { blockId }, mainPanelId);
      orca.nav.switchFocusTo(mainPanelId);
    } else {
      const sidebarPanelId = orca.state.activePanel;
      orca.nav.addTo(sidebarPanelId, "right", {
        view: "block",
        viewArgs: { blockId },
        viewState: {},
      });
    }
  }, [state.lastActiveEditorPanelId, orcaState.activePanel]);

  const { isDragOver, dragHandlers } = useDragDrop({ onDrop: handleDrop });

  const focusedBlockId = getFocusedBlock(orcaState.panels, state.lastActiveEditorPanelId || orcaState.activePanel);

  const rootBlock = state.rootBlockId ? orcaState.blocks[state.rootBlockId] : null;
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

      <div className="block-nav-header" style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid var(--orca-border)' }}>
        {parentId && (
          <div
            style={{
              cursor: 'pointer',
              opacity: 0.6,
              marginRight: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px',
              borderRadius: '4px'
            }}
            className="hover-bg"
            onClick={(e) => {
              e.stopPropagation();
              handleNavigate(parentId);
            }}
          >
            <i className="ti ti-arrow-up" />
          </div>
        )}
        <div 
          className="block-nav-header-title" 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            color: state.rootBlockId ? getBlockColorForId(state.rootBlockId) : undefined,
            cursor: state.rootBlockId ? 'pointer' : 'default',
            flex: 1,
            overflow: 'hidden'
          }}
          onClick={() => {
            if (state.rootBlockId) {
              handleNavigate(state.rootBlockId);
            }
          }}
        >
          {state.rootBlockId ? (
            <>
              <BlockIcon iconValue={getBlockIconForId(state.rootBlockId)} color={getBlockColorForId(state.rootBlockId)} />
              <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {getBlockTitle(state.rootBlockId)}
              </span>
            </>
          ) : (
            t("block-nav.no-block")
          )}
        </div>
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
