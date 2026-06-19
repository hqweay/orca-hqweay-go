# Let's Roam Sidebar

An Orca Note plugin that introduces a Roam Research-style global right sidebar. It acts as a powerful "bucket" for temporary collection, block referencing, and cross-document workspace organization.

## Features

- **Global Singleton Bucket**: Click the "Roam Sidebar" icon in the right headbar to open your global collection bucket. It opens the exact same dedicated block everywhere, ensuring your collected blocks are never lost and don't clutter your graph with orphaned blocks.
- **True Native Block Rendering**: Drag any block into the empty space or between items in the sidebar to append it to your bucket. Blocks in the sidebar are rendered natively, meaning all menus, drag handles, and slash commands work perfectly without clipping.
- **Native Block Reordering**: Since the side panel embraces Orca's native `Block` component, dragging a block *into* an existing sidebar card triggers the standard Orca block reordering/nesting logic automatically.
- **State Persistence**: Your stacked blocks and their fold states are natively saved into the underlying `roam-sidebar` block's `_repr` properties. Even after closing the app or refreshing, your sidebar state remains intact.
- **Collapse All / Expand All**: Easily manage a huge stack of blocks by toggling the "Collapse All" button at the top right, turning your sidebar into a clean outline. Click the caret icon on individual items to fold/unfold their children without hiding the root block's text.

## How to use

1. Enable the plugin in settings.
2. Click the right sidebar icon (the rectangular icon with a right panel) on the top right corner of the editor.
3. Drag blocks from your main editor directly into the empty area of the sidebar to stack them.
4. Drag blocks into existing cards to nest them natively.
5. Click the "X" button on the breadcrumb to remove a block from the bucket (this only removes it from the sidebar, it does not delete the original block).

## Technical Details
This component works by creating a single global Custom Block Renderer (`type: "roam-sidebar"`). The stacked blocks are essentially a list of Block IDs mapped and rendered as root native `<Block />` components. The state is synchronized between Valtio (for reactive UI) and the custom block's properties (for graph persistence).
