# ADR 0006: Orca Panel Layout Management and Shared Nav Utilities

## Context
During the development and stabilization of sidebar plugins (`lets-block-nav` and `lets-arc-tabs`), we encountered significant layout thrashing, flickering, and infinite loops. These issues arose from attempts to manually control the initialization width of sidebars (to avoid Orca's default 50/50 split) using `MutationObserver`, CSS injection (`flex-basis` with `!important`), and custom drag bars.

Additionally, we observed that when a second sidebar is opened vertically (stacking below an existing one), the first sidebar visually flickers and loses its internal React state.

Finally, multiple plugins were duplicating complex logic for traversing Orca's panel tree to find active editors or specific blocks.

## Decisions

### 1. Fully Delegate Sidebar Layout to Native Engine
We will no longer attempt to force sidebar widths, hide native resizers, or inject layout CSS via `MutationObserver`. 
- We strictly rely on `orca.nav.addTo(targetPanelId, side)`.
- If the target is already a sidebar, we use `appendSide = "bottom"` to naturally stack them.
- We accept that new panels will natively divide the available space (50/50) and leave any width adjustments entirely up to the user via the native `react-split-pane` drag handles.

### 2. Acknowledge and Accept React Reconciliation Constraints
When sidebars are vertically stacked, Orca's layout engine wraps the existing sidebar into a new vertical `SplitPane` container. 
- Because the React parent changes, the virtual DOM reconciliation forces an **Unmount and Remount** of the existing sidebar.
- **Decision:** Plugins must be designed to accept this lifecycle event. Sidebar components should not rely on ephemeral local `useState` for critical data, as it will be lost during vertical stacking. If state persistence is needed across layout shifts, it must be stored globally (e.g., in Valtio state stores like `blockNavState` or `arcTabsState`).

### 3. Centralize Nav Utilities
All panel-tree traversal logic has been extracted from individual plugins into a single, shared library.
- Use `@/libs/navUtils` for `findMainPanelId`, `isEditorPanel`, `getActiveBlocks`, and `getFocusedBlock`.
- Individual plugins should never write their own recursive panel tree traversal algorithms.

## Consequences
- **Positive**: Complete elimination of infinite loops and DOM-fighting bugs. Drastic reduction in codebase complexity (removal of custom resize hooks and observer utilities). Uniform sidebar drag-and-drop behavior driven natively by Orca.
- **Negative**: Users must manually adjust the sidebar width the first time it opens, as it will default to a 50% split. Sidebars will flicker and reset local state when stacked vertically.
