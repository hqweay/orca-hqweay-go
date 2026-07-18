import { useState, useEffect, useRef, useCallback } from "react";
import { useSnapshot } from "valtio";
import styles from "../styles.css?inline";
import { t } from "@/libs/l10n";
import {
  roamSidebarState,
  activeTab,
  createTab,
  deleteTab,
  renameTab,
  duplicateTab,
  setActiveTab,
  moveTab,
  addStackedBlock,
  removeStackedBlock,
  moveStackedBlock,
  collapseAll,
  expandAll,
  toggleBlockCollapse,
} from "../utils/state";
import React from "react";

interface RendererProps {
  panelId: string;
  blockId: number;
  rndId: string;
  blockLevel: number;
  indentLevel: number;
}

export const RoamSidebarRenderer = (props: RendererProps) => {
  const { panelId, blockId } = props;
  const state = useSnapshot(roamSidebarState);
  const [isDragOver, setIsDragOver] = useState(false);

  const blocksSnap = useSnapshot(orca.state.blocks);
  const block = blocksSnap[blockId];

  const isInitialized = useRef(false);
  const initializedBlockIdRef = useRef<number | null>(null);

  // Block reorder drag state
  const [draggedBlockId, setDraggedBlockId] = useState<number | null>(null);
  const [insertionIndex, setInsertionIndex] = useState<number | null>(null);

  // Tab context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    tabIndex: number;
  } | null>(null);

  // Tab rename state
  const [renamingTabIndex, setRenamingTabIndex] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Tab drag reorder state
  const [draggedTabIndex, setDraggedTabIndex] = useState<number | null>(null);
  const [tabInsertionIndex, setTabInsertionIndex] = useState<number | null>(null);

  // New tab modal state
  const [showNewTabModal, setShowNewTabModal] = useState(false);
  const [newTabName, setNewTabName] = useState("");

  if (initializedBlockIdRef.current !== blockId) {
    isInitialized.current = false;
    initializedBlockIdRef.current = blockId;
  }

  const Block = orca.components.Block;
  const BlockBreadcrumb = orca.components.BlockBreadcrumb;

  // Initialize from block's _repr
  useEffect(() => {
    if (isInitialized.current) return;

    if (block) {
      const reprProp = block.properties?.find((p: any) => p.name === "_repr");
      const reprVal = reprProp?.value;

      if (reprVal?.tabs) {
        roamSidebarState.tabs = JSON.parse(JSON.stringify(reprVal.tabs));
        roamSidebarState.activeTabIndex = reprVal.activeTabIndex ?? 0;
      } else if (reprVal?.stackedBlocks) {
        roamSidebarState.tabs = [
          {
            id: `tab-migrated-${Date.now()}`,
            name: "Tab 1",
            stackedBlocks: JSON.parse(JSON.stringify(reprVal.stackedBlocks)),
          },
        ];
        roamSidebarState.activeTabIndex = 0;
      } else {
        roamSidebarState.tabs = [
          { id: `tab-init-${Date.now()}`, name: "Tab 1", stackedBlocks: [] },
        ];
        roamSidebarState.activeTabIndex = 0;
      }
      isInitialized.current = true;
    }
  }, [blockId, block]);

  // Save to block's _repr when state changes
  useEffect(() => {
    if (!isInitialized.current) return;

    const directBlock = orca.state.blocks[blockId];
    if (!directBlock) return;

    const reprProp = directBlock.properties?.find((p: any) => p.name === "_repr");
    const reprVal = reprProp?.value || { type: "roam-sidebar" };

    const newStateJSON = JSON.stringify({
      tabs: roamSidebarState.tabs,
      activeTabIndex: roamSidebarState.activeTabIndex,
    });
    const currentJSON = JSON.stringify({
      tabs: reprVal.tabs,
      activeTabIndex: reprVal.activeTabIndex,
    });

    if (currentJSON !== newStateJSON) {
      orca.commands.invokeEditorCommand(
        "core.editor.setProperties",
        null,
        [blockId],
        [
          {
            name: "_repr",
            type: 0,
            value: {
              ...reprVal,
              tabs: JSON.parse(newStateJSON).tabs,
              activeTabIndex: roamSidebarState.activeTabIndex,
              stackedBlocks: undefined,
            },
          },
        ],
      );
    }
  }, [state.tabs, state.activeTabIndex, blockId]);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [contextMenu]);

  // Focus rename input when it appears
  useEffect(() => {
    if (renamingTabIndex !== null && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingTabIndex]);

  // Parse drag data from editor blocks
  const parseDragData = (e: React.DragEvent): number[] => {
    const types = Array.from(e.dataTransfer.types);

    const orcaRepoType = types.find((t) => {
      const parts = t.split("/");
      return parts.length === 2 && parts[0] === "orca";
    });
    const orcaRepoData = orcaRepoType
      ? e.dataTransfer.getData(orcaRepoType)
      : "";

    const textData = e.dataTransfer.getData("text/plain");

    const data = orcaRepoData || textData;
    if (!data) return [];

    let ids: number[] = [];

    let parsed;
    try {
      parsed = JSON.parse(data);
    } catch {
      parsed = data;
    }

    if (typeof parsed === "object" && parsed !== null) {
      if (parsed.id) ids.push(Number(parsed.id));
      else if (Array.isArray(parsed.blockIds))
        ids = parsed.blockIds.map(Number);
      else if (Array.isArray(parsed.blocks)) ids = parsed.blocks.map(Number);
      else if (Array.isArray(parsed) && parsed[0]?.id)
        ids = parsed.map((b: any) => Number(b.id));
    } else if (typeof parsed === "string") {
      const numId = Number(parsed);
      if (!isNaN(numId) && numId > 0) ids.push(numId);
    }

    return ids.filter((id) => !isNaN(id) && id > 0);
  };

  const dragCounter = React.useRef(0);

  // Handle drop from editor (add to sidebar)
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragOver(false);

    // If we have an insertion index, this is a block reorder drop
    if (draggedBlockId !== null && insertionIndex !== null) {
      const tab = activeTab();
      if (tab) {
        const fromIndex = tab.stackedBlocks.findIndex(
          (b) => b.id === draggedBlockId
        );
        if (fromIndex !== insertionIndex && fromIndex !== insertionIndex - 1) {
          moveStackedBlock(draggedBlockId, insertionIndex);
        }
      }
      setDraggedBlockId(null);
      setInsertionIndex(null);
      return;
    }

    // Otherwise, add new blocks from editor
    try {
      const ids = parseDragData(e);
      if (ids.length > 0) {
        ids.forEach((id) => addStackedBlock(id));
      }
    } catch (err) {
      console.error("Failed to parse dragged block data:", err);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragOver(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = draggedBlockId !== null ? "move" : "copy";
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDragOver(false);
    }
  };

  // --- Block reorder drag handlers ---

  const handleItemDragStart = useCallback((e: React.DragEvent, id: number) => {
    e.stopPropagation();
    setDraggedBlockId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(id));
  }, []);

  const handleItemDragEnd = useCallback(() => {
    setDraggedBlockId(null);
    setInsertionIndex(null);
  }, []);

  const handleItemDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedBlockId === null) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const insertAt = e.clientY < midY ? index : index + 1;
    setInsertionIndex(insertAt);
  }, [draggedBlockId]);

  // --- Tab drag reorder handlers ---

  const handleTabDragStart = useCallback((e: React.DragEvent, index: number) => {
    e.stopPropagation();
    setDraggedTabIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  }, []);

  const handleTabDragEnd = useCallback(() => {
    setDraggedTabIndex(null);
    setTabInsertionIndex(null);
  }, []);

  const handleTabDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedTabIndex === null) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const insertAt = e.clientX < midX ? index : index + 1;
    setTabInsertionIndex(insertAt);
  }, [draggedTabIndex]);

  const handleTabDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedTabIndex !== null && tabInsertionIndex !== null) {
      moveTab(draggedTabIndex, tabInsertionIndex);
    }
    setDraggedTabIndex(null);
    setTabInsertionIndex(null);
  }, [draggedTabIndex, tabInsertionIndex]);

  // --- Tab context menu ---

  const handleTabContextMenu = useCallback((e: React.MouseEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, tabIndex: index });
  }, []);

  const handleNewTab = useCallback(() => {
    setNewTabName("");
    setShowNewTabModal(true);
  }, []);

  const handleNewTabSubmit = useCallback(() => {
    if (newTabName.trim()) {
      createTab(newTabName.trim());
    }
    setShowNewTabModal(false);
    setNewTabName("");
  }, [newTabName]);

  const handleRenameTab = useCallback((index: number) => {
    setRenamingTabIndex(index);
    setRenameValue(state.tabs[index]?.name || "");
    setContextMenu(null);
  }, [state.tabs]);

  const handleRenameSubmit = useCallback(() => {
    if (renamingTabIndex !== null && renameValue.trim()) {
      renameTab(renamingTabIndex, renameValue.trim());
    }
    setRenamingTabIndex(null);
  }, [renamingTabIndex, renameValue]);

  const currentTab = activeTab();
  const currentBlocks = currentTab?.stackedBlocks || [];

  return (
    <div
      className={`roam-sidebar-container ${isDragOver ? "roam-sidebar-drag-over" : ""}`}
      onDrop={handleDrop}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      style={{ minHeight: "100vh", paddingBottom: "100px" }}
    >
      <style dangerouslySetInnerHTML={{ __html: styles }} />

      {/* Tab Bar */}
      {state.tabs.length > 1 && (
        <div className="roam-sidebar-tab-bar" contentEditable={false}>
          {state.tabs.map((tab, index) => (
            <React.Fragment key={tab.id}>
              {draggedTabIndex !== null && tabInsertionIndex === index && (
                <div className="roam-sidebar-tab-insertion-line" />
              )}
              <div
                className={`roam-sidebar-tab ${state.activeTabIndex === index ? "roam-sidebar-tab-active" : ""} ${draggedTabIndex === index ? "roam-sidebar-tab-dragging" : ""}`}
                draggable={true}
                onDragStart={(e) => handleTabDragStart(e, index)}
                onDragEnd={handleTabDragEnd}
                onDragOver={(e) => handleTabDragOver(e, index)}
                onDrop={handleTabDrop}
                onClick={() => setActiveTab(index)}
                onContextMenu={(e) => handleTabContextMenu(e, index)}
              >
                {renamingTabIndex === index ? (
                  <input
                    ref={renameInputRef}
                    className="roam-sidebar-tab-rename-input"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={handleRenameSubmit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRenameSubmit();
                      if (e.key === "Escape") setRenamingTabIndex(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="roam-sidebar-tab-name">{tab.name}</span>
                )}
              </div>
            </React.Fragment>
          ))}
          {draggedTabIndex !== null && tabInsertionIndex === state.tabs.length && (
            <div className="roam-sidebar-tab-insertion-line" />
          )}
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="roam-sidebar-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          contentEditable={false}
        >
          <div
            className="roam-sidebar-context-menu-item"
            onClick={() => {
              handleRenameTab(contextMenu.tabIndex);
            }}
          >
            <i className="ti ti-pencil" /> {t("roam-sidebar.rename-tab")}
          </div>
          <div
            className="roam-sidebar-context-menu-item"
            onClick={() => {
              duplicateTab(contextMenu.tabIndex);
              setContextMenu(null);
            }}
          >
            <i className="ti ti-copy" /> {t("roam-sidebar.duplicate-tab")}
          </div>
          <div className="roam-sidebar-context-menu-separator" />
          <div
            className="roam-sidebar-context-menu-item roam-sidebar-context-menu-danger"
            onClick={() => {
              deleteTab(contextMenu.tabIndex);
              setContextMenu(null);
            }}
          >
            <i className="ti ti-trash" /> {t("roam-sidebar.delete-tab")}
          </div>
        </div>
      )}

      {/* New Tab Modal */}
      {showNewTabModal && (
        <orca.components.ModalOverlay
          visible={showNewTabModal}
          onClose={() => {
            setShowNewTabModal(false);
            setNewTabName("");
          }}
          blurred={true}
          style={{
            backgroundColor: "rgba(0, 0, 0, 0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              background: "var(--orca-color-bg-1)",
              color: "var(--orca-text-color)",
              padding: "20px",
              borderRadius: "12px",
              width: "320px",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)",
              border: "1px solid var(--orca-color-border-2)",
            }}
          >
            <h3
              style={{
                margin: "0 0 16px 0",
                fontSize: "15px",
                fontWeight: 600,
              }}
            >
              {t("roam-sidebar.tab-name-prompt")}
            </h3>
            <orca.components.Input
              value={newTabName}
              onChange={(e: any) => setNewTabName(e.target.value)}
              onKeyDown={(e: any) => {
                if (e.key === "Enter") handleNewTabSubmit();
                if (e.key === "Escape") {
                  setShowNewTabModal(false);
                  setNewTabName("");
                }
              }}
              placeholder={t("roam-sidebar.tab-name-placeholder") || "Tab name"}
              autoFocus
              width="100%"
            />
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "8px",
                marginTop: "16px",
              }}
            >
              <orca.components.Button
                variant="plain"
                onClick={() => {
                  setShowNewTabModal(false);
                  setNewTabName("");
                }}
              >
                {t("common.cancel")}
              </orca.components.Button>
              <orca.components.Button
                variant="solid"
                onClick={handleNewTabSubmit}
                disabled={!newTabName.trim()}
              >
                {t("common.confirm")}
              </orca.components.Button>
            </div>
          </div>
        </orca.components.ModalOverlay>
      )}

      {/* Content */}
      {currentBlocks.length === 0 ? (
        <div
          className={`roam-sidebar-empty ${isDragOver ? "roam-sidebar-empty-active" : ""}`}
          contentEditable={false}
        >
          <div className="roam-sidebar-empty-icon">
            {isDragOver ? (
              <i className="ti ti-download" />
            ) : (
              <i className="ti ti-layout-sidebar-right" />
            )}
          </div>
          <div className="roam-sidebar-empty-text">
            {isDragOver
              ? t("roam-sidebar.drop-to-add")
              : t("roam-sidebar.drag-here")}
          </div>
          <div className="roam-sidebar-empty-hint">
            {isDragOver
              ? t("roam-sidebar.release-mouse")
              : t("roam-sidebar.split-view")}
          </div>
        </div>
      ) : (
        <div className="roam-sidebar-stack">
          <div
            className="roam-sidebar-toolbar"
            contentEditable={false}
            style={{
              display: "flex",
              justifyContent: "flex-end",
              padding: "4px 12px",
              gap: "8px",
              opacity: 0.6,
              fontSize: "13px",
            }}
          >
            {state.tabs.length <= 1 && (
              <div style={{ cursor: "pointer" }} onClick={handleNewTab}>
                <i className="ti ti-plus" /> {t("roam-sidebar.new-tab")}
              </div>
            )}
            <div style={{ cursor: "pointer" }} onClick={expandAll}>
              <i className="ti ti-layout-bottombar-expand" />{" "}
              {t("roam-sidebar.expand-all")}
            </div>
            <div style={{ cursor: "pointer" }} onClick={collapseAll}>
              <i className="ti ti-layout-topbar-collapse" />{" "}
              {t("roam-sidebar.collapse-all")}
            </div>
          </div>
          {currentBlocks.map((b, index) => (
            <React.Fragment key={b.id}>
              {draggedBlockId !== null && insertionIndex === index && (
                <div className="roam-sidebar-insertion-line" />
              )}
              <div
                className={`roam-sidebar-item ${draggedBlockId === b.id ? "roam-sidebar-item-dragging" : ""}`}
                draggable={true}
                onDragStart={(e) => handleItemDragStart(e, b.id)}
                onDragEnd={handleItemDragEnd}
                onDragOver={(e) => handleItemDragOver(e, index)}
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
                    onClick={() => toggleBlockCollapse(b.id)}
                  >
                    <i
                      className={
                        b.collapsed ? "ti ti-caret-right" : "ti ti-caret-down"
                      }
                      style={{ fontSize: "14px" }}
                    />
                  </div>
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    <BlockBreadcrumb blockId={b.id} />
                  </div>
                  <div
                    className="roam-sidebar-item-close-action"
                    title={t("roam-sidebar.close-card")}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeStackedBlock(b.id);
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
                    key={`roam-block-${b.id}-${b.collapsed}`}
                    panelId={panelId}
                    blockId={b.id}
                    blockLevel={0}
                    indentLevel={0}
                    renderingMode="normal"
                    initiallyCollapsed={!!b.collapsed}
                  />
                </div>
              </div>
            </React.Fragment>
          ))}
          {draggedBlockId !== null && insertionIndex === currentBlocks.length && (
            <div className="roam-sidebar-insertion-line" />
          )}
          <div
            className={`roam-sidebar-dropzone-footer ${isDragOver ? "roam-sidebar-dropzone-active" : ""}`}
            contentEditable={false}
          >
            <div className="roam-sidebar-dropzone-icon">
              {isDragOver ? (
                <i className="ti ti-plus" />
              ) : (
                <i className="ti ti-dots" />
              )}
            </div>
            <span>
              {isDragOver
                ? t("roam-sidebar.drop-to-append")
                : t("roam-sidebar.continue-adding")}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
