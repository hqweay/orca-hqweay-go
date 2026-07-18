import { useState, useEffect, useRef, useCallback, useMemo, useDeferredValue } from "react";
import { useSnapshot } from "valtio";
import styles from "../styles.css?inline";
import { t } from "@/libs/l10n";
import { parseBlockDragData } from "@/libs/dragUtils";
import {
  roamSidebarState,
  activeTab,
  createTab,
  addStackedBlock,
  removeStackedBlock,
  moveStackedBlock,
  collapseAll,
  expandAll,
  toggleBlockCollapse,
  clearActiveTab,
} from "../utils/state";
import { TabBar } from "./TabBar";
import { StackedBlockItem } from "./StackedBlockItem";
import { EmptyState } from "./EmptyState";
import { DropZoneFooter } from "./DropZoneFooter";
import { NewTabModal } from "./NewTabModal";
import { ConfirmModal } from "./ConfirmModal";
import { BlockSearch } from "./BlockSearch";
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

  const [draggedBlockId, setDraggedBlockId] = useState<number | null>(null);
  const [insertionIndex, setInsertionIndex] = useState<number | null>(null);

  const [showNewTabModal, setShowNewTabModal] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const deferredQuery = useDeferredValue(searchQuery);
  const searchQueryRef = useRef(searchQuery);
  useEffect(() => { searchQueryRef.current = searchQuery; }, [searchQuery]);

  if (initializedBlockIdRef.current !== blockId) {
    isInitialized.current = false;
    initializedBlockIdRef.current = blockId;
  }

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

  const dragCounter = React.useRef(0);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragOver(false);

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

    try {
      const ids = parseBlockDragData(e);
      if (ids.length > 0) {
        if (insertionIndex !== null) {
          let insertAt = insertionIndex;
          ids.forEach((id) => {
            addStackedBlock(id, insertAt);
            insertAt++;
          });
        } else {
          ids.forEach((id) => addStackedBlock(id));
        }
      }
    } catch (err) {
      console.error("Failed to parse dragged block data:", err);
    }
    setInsertionIndex(null);
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
      setInsertionIndex(null);
    }
  };

  const handleItemDragStart = useCallback((e: React.DragEvent, id: number) => {
    if (searchQueryRef.current) return;
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
    if (searchQueryRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const insertAt = e.clientY < midY ? index : index + 1;
    setInsertionIndex(insertAt);
  }, []);

  const handleNewTabSubmit = useCallback((name: string) => {
    createTab(name);
  }, []);

  const currentTab = state.tabs[state.activeTabIndex];
  const currentBlocks = currentTab?.stackedBlocks || [];

  useEffect(() => { setSearchQuery(""); }, [state.activeTabIndex]);

  const filteredBlocks = useMemo(() => {
    if (!deferredQuery.trim()) return currentBlocks;
    const q = deferredQuery.toLowerCase();
    return currentBlocks.filter(b => {
      const blockData = blocksSnap[b.id];
      const text = blockData?.text || "";
      return text.toLowerCase().includes(q);
    });
  }, [currentBlocks, deferredQuery, blocksSnap]);

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

      <TabBar onRequestNewTab={() => setShowNewTabModal(true)} />

      <NewTabModal
        visible={showNewTabModal}
        onClose={() => setShowNewTabModal(false)}
        onSubmit={handleNewTabSubmit}
      />

      <ConfirmModal
        visible={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={() => {
          clearActiveTab();
          setShowClearConfirm(false);
        }}
        title={t("roam-sidebar.clear-all-confirm-title")}
        description={t("roam-sidebar.clear-all-confirm-desc")}
        danger
      />

      {currentBlocks.length === 0 ? (
        <EmptyState isDragOver={isDragOver} />
      ) : (
        <div className="roam-sidebar-stack">
          <div
            className="roam-sidebar-toolbar"
            contentEditable={false}
            style={{
              display: "flex",
              alignItems: "center",
              padding: "4px 12px",
              gap: "8px",
              opacity: 0.6,
              fontSize: "13px",
            }}
          >
            <BlockSearch query={searchQuery} onSearch={setSearchQuery} />
            <div style={{ display: "flex", gap: "8px", marginLeft: "auto" }}>
              {state.tabs.length <= 1 && (
                <div style={{ cursor: "pointer", flexShrink: 0 }} onClick={() => setShowNewTabModal(true)}>
                  <i className="ti ti-plus" /> {t("roam-sidebar.new-tab")}
                </div>
              )}
              <div style={{ cursor: "pointer", flexShrink: 0 }} onClick={expandAll}>
                <i className="ti ti-layout-bottombar-expand" />{" "}
                {t("roam-sidebar.expand-all")}
              </div>
              <div style={{ cursor: "pointer", flexShrink: 0 }} onClick={collapseAll}>
                <i className="ti ti-layout-topbar-collapse" />{" "}
                {t("roam-sidebar.collapse-all")}
              </div>
              <div
                style={{ cursor: "pointer", flexShrink: 0 }}
                onClick={() => setShowClearConfirm(true)}
              >
                <i className="ti ti-trash" /> {t("roam-sidebar.clear-all")}
              </div>
            </div>
          </div>
          {filteredBlocks.length === 0 ? (
            <div style={{ padding: "16px 12px", textAlign: "center", opacity: 0.5, fontSize: "13px" }}>
              {t("roam-sidebar.search-no-results")}
            </div>
          ) : (
            <>
              {filteredBlocks.map((b, index) => (
                <StackedBlockItem
                  key={b.id}
                  block={b}
                  index={index}
                  panelId={panelId}
                  childCount={blocksSnap[b.id]?.children?.length || 0}
                  isDragging={draggedBlockId === b.id}
                  showInsertionLine={draggedBlockId !== null && insertionIndex === index}
                  onDragStart={handleItemDragStart}
                  onDragEnd={handleItemDragEnd}
                  onDragOver={handleItemDragOver}
                  onToggleCollapse={toggleBlockCollapse}
                  onRemove={removeStackedBlock}
                />
              ))}
              {draggedBlockId !== null && insertionIndex === filteredBlocks.length && (
                <div className="roam-sidebar-insertion-line" />
              )}
            </>
          )}
          <DropZoneFooter isDragOver={isDragOver} />
        </div>
      )}
    </div>
  );
};
