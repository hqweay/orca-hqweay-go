import { useState, useEffect, useRef } from "react";
import { useSnapshot } from "valtio";
import styles from "../styles.css?inline";
import {
  roamSidebarState,
  addStackedBlock,
  removeStackedBlock,
  collapseAll,
  expandAll,
  toggleBlockCollapse,
} from "../utils/state";

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
  const isInitialized = useRef(false);
  const Block = orca.components.Block;
  const BlockBreadcrumb = orca.components.BlockBreadcrumb;

  // Initialize from block's _repr
  useEffect(() => {
    const block = orca.state.blocks[blockId];
    if (block) {
      const reprProp = block.properties?.find((p: any) => p.name === "_repr");
      if (reprProp && reprProp.value?.stackedBlocks) {
        // Hydrate from DB
        roamSidebarState.stackedBlocks = reprProp.value.stackedBlocks;
      }
    }
    isInitialized.current = true;
  }, [blockId]);

  // Save to block's _repr when state changes
  useEffect(() => {
    if (!isInitialized.current) return;

    const block = orca.state.blocks[blockId];
    if (!block) return;

    const reprProp = block.properties?.find((p: any) => p.name === "_repr");
    const reprVal = reprProp?.value || { type: "roam-sidebar" };

    const currentJSON = JSON.stringify(reprVal.stackedBlocks || []);
    const newStateJSON = JSON.stringify(roamSidebarState.stackedBlocks);

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
              stackedBlocks: roamSidebarState.stackedBlocks,
            },
          },
        ],
      );
    }
  }, [state.stackedBlocks, blockId]);

  const parseDragData = (e: React.DragEvent): number[] => {
    const types = Array.from(e.dataTransfer.types);

    const textData = e.dataTransfer.getData("text/plain");
    const jsonData = e.dataTransfer.getData("application/json");
    const orcaBlocks = e.dataTransfer.getData("application/x-orca-blocks");
    const orcaCustomType = types.find((t) => t.startsWith("orca/"));
    const orcaCustomData = orcaCustomType
      ? e.dataTransfer.getData(orcaCustomType)
      : "";

    const data = jsonData || orcaBlocks || orcaCustomData || textData;
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

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragOver(false);

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
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDragOver(false);
    }
  };

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
            {isDragOver ? "释放以添加块" : "拖拽块到此处"}
          </div>
          <div className="roam-sidebar-empty-hint">
            {isDragOver ? "松开鼠标" : "分屏查看内容"}
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
              <i className="ti ti-layout-bottombar-expand" /> 展开全部
            </div>
            <div style={{ cursor: "pointer" }} onClick={collapseAll}>
              <i className="ti ti-layout-topbar-collapse" /> 折叠全部
            </div>
          </div>
          {state.stackedBlocks.map((b) => (
            <div key={b.id} className="roam-sidebar-item">
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
                  title="关闭"
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
          ))}
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
            <span>{isDragOver ? "释放以添加" : "继续添加块"}</span>
          </div>
        </div>
      )}
    </div>
  );
};
