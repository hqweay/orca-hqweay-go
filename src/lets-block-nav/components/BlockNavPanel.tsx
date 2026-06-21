import React, { useEffect, useCallback } from "react";
import { useSnapshot } from "valtio";
import { t } from "@/libs/l10n";
import {
  blockNavState,
  setRootBlock,
  setItems,
  clearSelection,
  expandAll,
  collapseAll,
} from "../utils/state";
import {
  getCurrentBlockId,
  getChildBlocks,
  buildNavItems,
  moveBlockToParent,
  deleteBlocks,
  getBlockTitle,
} from "../utils/blocks";
import { useDragDrop } from "../utils/useDragDrop";
import { BlockNodeItem } from "./BlockNodeItem";
import { findMainPanelId, isEditorPanel, getFocusedBlock } from "../utils/nav";
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
    let blockId = getFocusedBlock(orcaState.panels, state.lastActiveEditorPanelId || orcaState.activePanel);
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

  const handleDrop = useCallback(
    async (blockIds: number[]) => {
      if (!state.rootBlockId) return;
      for (const id of blockIds) {
        await moveBlockToParent(id, state.rootBlockId);
      }
      await loadChildren(state.rootBlockId);
    },
    [state.rootBlockId, loadChildren]
  );

  const handleDropOnNode = useCallback(
    async (blockIds: number[], targetId: number) => {
      for (const id of blockIds) {
        if (id === targetId) continue;
        await moveBlockToParent(id, targetId);
      }
      if (state.rootBlockId) {
        await loadChildren(state.rootBlockId);
      }
    },
    [state.rootBlockId, loadChildren]
  );

  const handleDeleteSelected = useCallback(async () => {
    const ids = Array.from(state.selectedIds);
    if (ids.length === 0) return;
    await deleteBlocks(ids);
    clearSelection();
    if (state.rootBlockId) {
      await loadChildren(state.rootBlockId);
    }
  }, [state.selectedIds, state.rootBlockId, loadChildren]);

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

  return (
    <div
      ref={containerRef}
      className={`block-nav-panel ${isDragOver ? "block-nav-panel-drag-over" : ""}`}
      {...dragHandlers}
    >
      <style dangerouslySetInnerHTML={{ __html: styles }} />

      <div className="block-nav-header">
        <div className="block-nav-header-title">
          {state.rootBlockId
            ? getBlockTitle(state.rootBlockId)
            : t("block-nav.no-block")}
        </div>
      </div>

      <div className="block-nav-toolbar">
        <div className="block-nav-toolbar-actions">
          <span onClick={expandAll} className="block-nav-toolbar-btn">
            <i className="ti ti-layout-bottombar-expand" />{" "}
            {t("block-nav.expand-all")}
          </span>
          <span onClick={collapseAll} className="block-nav-toolbar-btn">
            <i className="ti ti-layout-topbar-collapse" />{" "}
            {t("block-nav.collapse-all")}
          </span>
        </div>
        {state.selectedIds.size > 0 && (
          <div className="block-nav-toolbar-selection">
            <span onClick={clearSelection} className="block-nav-toolbar-btn">
              {t("block-nav.clear-selection")}
            </span>
            <span
              onClick={handleDeleteSelected}
              className="block-nav-toolbar-btn block-nav-toolbar-btn-danger"
            >
              <i className="ti ti-trash" /> {t("block-nav.delete-selected")}
            </span>
          </div>
        )}
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
