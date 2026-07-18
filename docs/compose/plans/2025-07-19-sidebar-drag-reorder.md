# Sidebar Drag Reorder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add drag-and-drop reordering for blocks within the Roam Sidebar.

**Architecture:** Each sidebar block gets a drag handle in its breadcrumb row. Dragging a block shows an insertion line at the drop position. On drop, the block moves to the new position. Order is persisted via the `stackedBlocks` array order in `_repr`.

**Tech Stack:** React, Valtio, native HTML5 Drag and Drop API

---

### Task 1: Add moveStackedBlock to state.ts

**Covers:** State management for reordering

**Files:**
- Modify: `src/lets-roam-sidebar/utils/state.ts:1-40`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lets-roam-sidebar/utils/__tests__/state.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { roamSidebarState, addStackedBlock, moveStackedBlock } from "../state";

describe("moveStackedBlock", () => {
  beforeEach(() => {
    roamSidebarState.stackedBlocks = [];
  });

  it("moves a block from one position to another", () => {
    addStackedBlock(1); // [1]
    addStackedBlock(2); // [2, 1]
    addStackedBlock(3); // [3, 2, 1]

    moveStackedBlock(3, 1); // move 3 to index 1: [2, 3, 1]

    expect(roamSidebarState.stackedBlocks.map(b => b.id)).toEqual([2, 3, 1]);
  });

  it("does nothing if fromIndex equals toIndex", () => {
    addStackedBlock(1);
    addStackedBlock(2);

    moveStackedBlock(1, 0);

    expect(roamSidebarState.stackedBlocks.map(b => b.id)).toEqual([2, 1]);
  });

  it("does nothing if block not found", () => {
    addStackedBlock(1);

    moveStackedBlock(999, 0);

    expect(roamSidebarState.stackedBlocks.map(b => b.id)).toEqual([1]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lets-roam-sidebar/utils/__tests__/state.test.ts`
Expected: FAIL with "moveStackedBlock is not exported"

- [ ] **Step 3: Write minimal implementation**

Add to `src/lets-roam-sidebar/utils/state.ts`:

```typescript
export const moveStackedBlock = (blockId: number, toIndex: number) => {
  const fromIndex = roamSidebarState.stackedBlocks.findIndex(b => b.id === blockId);
  if (fromIndex < 0 || fromIndex === toIndex) return;

  const [moved] = roamSidebarState.stackedBlocks.splice(fromIndex, 1);
  roamSidebarState.stackedBlocks.splice(toIndex, 0, moved);
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lets-roam-sidebar/utils/__tests__/state.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lets-roam-sidebar/utils/state.ts src/lets-roam-sidebar/utils/__tests__/state.test.ts
git commit -m "feat(roam-sidebar): add moveStackedBlock for drag reorder"
```

---

### Task 2: Add drag handle and reorder logic to renderer

**Covers:** UI for drag handle, drop indicator, reorder behavior

**Files:**
- Modify: `src/lets-roam-sidebar/components/RoamSidebarRenderer.tsx:1-332`
- Modify: `src/lets-roam-sidebar/styles.css:1-172`

- [ ] **Step 1: Add CSS for drag handle and insertion line**

Add to `src/lets-roam-sidebar/styles.css`:

```css
/* Drag handle in breadcrumb */
.roam-sidebar-item-drag-handle {
  cursor: grab;
  padding: 2px 4px;
  opacity: 0;
  transition: opacity 0.15s ease;
  display: flex;
  align-items: center;
  color: var(--orca-text-muted);
  font-size: 14px;
  user-select: none;
}

.roam-sidebar-item:hover .roam-sidebar-item-drag-handle {
  opacity: 0.6;
}

.roam-sidebar-item-drag-handle:hover {
  opacity: 1 !important;
  color: var(--orca-text-primary);
}

/* Insertion line */
.roam-sidebar-insertion-line {
  height: 2px;
  background-color: var(--orca-brand-primary, #3b82f6);
  border-radius: 1px;
  margin: -1px 0;
  pointer-events: none;
  position: relative;
  z-index: 10;
}

/* Dragging state */
.roam-sidebar-item.roam-sidebar-item-dragging {
  opacity: 0.4;
}
```

- [ ] **Step 2: Update RoamSidebarRenderer with drag reorder logic**

Replace the full content of `src/lets-roam-sidebar/components/RoamSidebarRenderer.tsx` with:

```tsx
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
```

- [ ] **Step 3: Add localization key**

Add to the localization files (e.g., `src/libs/l10n/en.json`):

```json
"roam-sidebar.drag-to-reorder": "Drag to reorder"
```

- [ ] **Step 4: Manual test**

1. Open Orca Note with the roam-sidebar plugin enabled
2. Add 3+ blocks to the sidebar
3. Hover over a block - drag handle (⋮⋮) should appear on the left of breadcrumb
4. Drag a block to another position - insertion line should appear
5. Drop the block - it should move to the new position
6. Refresh the page - order should persist

- [ ] **Step 5: Commit**

```bash
git add src/lets-roam-sidebar/components/RoamSidebarRenderer.tsx src/lets-roam-sidebar/styles.css
git commit -m "feat(roam-sidebar): add drag-and-drop reorder with insertion line"
```

---

### Task 3: Handle edge cases

**Covers:** Robustness of drag reorder

**Files:**
- Modify: `src/lets-roam-sidebar/components/RoamSidebarRenderer.tsx`

- [ ] **Step 1: Fix insertion line at end of list**

The current implementation shows the insertion line at `insertionIndex === state.stackedBlocks.length` for the end position. Verify this works correctly by testing:
1. Drag a block past the last item
2. Insertion line should appear after the last item
3. Drop should move the block to the end

- [ ] **Step 2: Prevent self-drop**

Add a check in `handleDrop` to prevent dropping a block on itself:

```typescript
if (draggedBlockId !== null && insertionIndex !== null) {
  const fromIndex = roamSidebarState.stackedBlocks.findIndex(b => b.id === draggedBlockId);
  if (fromIndex !== insertionIndex && fromIndex !== insertionIndex - 1) {
    moveStackedBlock(draggedBlockId, insertionIndex);
  }
  setDraggedBlockId(null);
  setInsertionIndex(null);
  return;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lets-roam-sidebar/components/RoamSidebarRenderer.tsx
git commit -m "fix(roam-sidebar): prevent self-drop in reorder"
```

---

### Task 4: Add tests for moveStackedBlock edge cases

**Covers:** Edge cases in state management

**Files:**
- Modify: `src/lets-roam-sidebar/utils/__tests__/state.test.ts`

- [ ] **Step 1: Add edge case tests**

```typescript
describe("moveStackedBlock edge cases", () => {
  beforeEach(() => {
    roamSidebarState.stackedBlocks = [];
  });

  it("moves block to beginning", () => {
    addStackedBlock(1);
    addStackedBlock(2);
    addStackedBlock(3);

    moveStackedBlock(3, 0);

    expect(roamSidebarState.stackedBlocks.map(b => b.id)).toEqual([3, 1, 2]);
  });

  it("moves block to end", () => {
    addStackedBlock(1);
    addStackedBlock(2);
    addStackedBlock(3);

    moveStackedBlock(1, 3);

    expect(roamSidebarState.stackedBlocks.map(b => b.id)).toEqual([2, 3, 1]);
  });

  it("handles single element list", () => {
    addStackedBlock(1);

    moveStackedBlock(1, 0);

    expect(roamSidebarState.stackedBlocks.map(b => b.id)).toEqual([1]);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/lets-roam-sidebar/utils/__tests__/state.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lets-roam-sidebar/utils/__tests__/state.test.ts
git commit -m "test(roam-sidebar): add edge case tests for moveStackedBlock"
```
