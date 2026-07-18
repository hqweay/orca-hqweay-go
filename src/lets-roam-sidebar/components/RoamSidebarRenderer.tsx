import { useState, useEffect, useRef, useCallback } from "react";
import { useSnapshot } from "valtio";
import styles from "../styles.css?inline";
import { t } from "@/libs/l10n";
import {
  roamSidebarState,
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

  // Reorder drag state
  const [draggedBlockId, setDraggedBlockId] = useState<number | null>(null);
  const [insertionIndex, setInsertionIndex] = useState<number | null>(null);

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
      if (reprProp && reprProp.value?.stackedBlocks) {
        roamSidebarState.stackedBlocks = JSON.parse(
          JSON.stringify(reprProp.value.stackedBlocks)
        );
      } else {
        roamSidebarState.stackedBlocks = [];
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

    const currentJSON = JSON.stringify(reprVal.stackedBlocks || []);
    const newStateJSON = JSON.stringify(roamSidebarState.stackedBlocks);

    if (currentJSON !== newStateJSON) {
      const plainStackedBlocks = JSON.parse(newStateJSON);
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
              stackedBlocks: plainStackedBlocks,
            },
          },
        ],
      );
    }
  }, [state.stackedBlocks, blockId]);

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

    // If we have an insertion index, this is a reorder drop
    if (draggedBlockId !== null && insertionIndex !== null) {
      moveStackedBlock(draggedBlockId, insertionIndex);
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

  // Reorder drag handlers
  const handleItemDragStart = useCallback((e: React.DragEvent, blockId: number) => {
    e.stopPropagation();
    setDraggedBlockId(blockId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(blockId));
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
      {state.stackedBlocks.length === 0 ? (
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
            <div style={{ cursor: "pointer" }} onClick={expandAll}>
              <i className="ti ti-layout-bottombar-expand" />{" "}
              {t("roam-sidebar.expand-all")}
            </div>
            <div style={{ cursor: "pointer" }} onClick={collapseAll}>
              <i className="ti ti-layout-topbar-collapse" />{" "}
              {t("roam-sidebar.collapse-all")}
            </div>
          </div>
          {state.stackedBlocks.map((b, index) => (
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
          {draggedBlockId !== null && insertionIndex === state.stackedBlocks.length && (
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
