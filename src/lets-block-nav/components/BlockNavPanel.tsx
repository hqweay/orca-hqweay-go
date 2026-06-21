import React, { useEffect, useCallback } from "react";
import { useSnapshot } from "valtio";
import { t } from "@/libs/l10n";
import {
  blockNavState,
  setRootBlock,
  setItems,
} from "../utils/state";
import {
  getCurrentBlockId,
  getChildBlocks,
  buildNavItems,
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

  const loadChildren = useCallback(async (blockId: number) => {
    const blocks = await getChildBlocks(blockId);
    const items = buildNavItems(blocks);
    setItems(items);
  }, []);

  useEffect(() => {
    let editorPanelId = state.lastActiveEditorPanelId;
    if (orcaState.activePanel && isEditorPanel(orcaState.panels, orcaState.activePanel)) {
      editorPanelId = orcaState.activePanel;
    } else if (!editorPanelId) {
      editorPanelId = orcaState.activePanel;
    }

    let blockId = getFocusedBlock(orcaState.panels, editorPanelId);
    if (!blockId) return;

    const resolveAndLoad = async () => {
      let block = orca.state.blocks[blockId!];
      if (!block) {
        block = await orca.invokeBackend("get-block", blockId!);
      }
      if (block && block.parent) {
        blockId = Number(block.parent);
      }
      if (blockId && blockId !== blockNavState.rootBlockId) {
        setRootBlock(blockId);
        await loadChildren(blockId!);
      }
    };

    resolveAndLoad();
  }, [orcaState.activePanel, orcaState.panels]);

  useEffect(() => {
    if (orcaState.activePanel && isEditorPanel(orcaState.panels, orcaState.activePanel)) {
      blockNavState.lastActiveEditorPanelId = orcaState.activePanel;
    }
  }, [orcaState.activePanel, orcaState.panels]);

  useEffect(() => {
    if (state.rootBlockId) {
      loadChildren(state.rootBlockId);
    }
  }, [state.expandedIds]);

  const ensureEditorFocus = async (targetBlockId: number) => {
    let editorPanelId = state.lastActiveEditorPanelId;
    if (!editorPanelId || !orca.state.panels[editorPanelId]) {
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
      await loadChildren(state.rootBlockId);
    },
    [state.rootBlockId, state.lastActiveEditorPanelId, loadChildren]
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
        await loadChildren(state.rootBlockId);
      }
    },
    [state.rootBlockId, loadChildren]
  );

  const handleNavigate = useCallback((blockId: number) => {
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

  return (
    <div
      ref={containerRef}
      className={`block-nav-panel ${isDragOver ? "block-nav-panel-drag-over" : ""}`}
      {...dragHandlers}
    >
      <style dangerouslySetInnerHTML={{ __html: styles }} />

      <div className="block-nav-header">
        <div className="block-nav-header-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: state.rootBlockId ? getBlockColorForId(state.rootBlockId) : undefined }}>
          {state.rootBlockId ? (
            <>
              <BlockIcon iconValue={getBlockIconForId(state.rootBlockId)} color={getBlockColorForId(state.rootBlockId)} />
              <span>{getBlockTitle(state.rootBlockId)}</span>
            </>
          ) : (
            t("block-nav.no-block")
          )}
        </div>
      </div>

      <div className="block-nav-content">
        {state.items.length === 0 ? (
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
          state.items.map((item) => (
            <BlockNodeItem
              key={item.id}
              item={{
                ...item,
                children: item.children ? [...item.children] : undefined,
              }}
              isFocused={item.id === focusedBlockId}
              onNavigate={handleNavigate}
              onDropOnNode={handleDropOnNode}
            />
          ))
        )}
      </div>

      {isDragOver && state.items.length > 0 && (
        <div className="block-nav-drop-hint">
          <i className="ti ti-plus" /> {t("block-nav.drop-to-add")}
        </div>
      )}
    </div>
  );
};
