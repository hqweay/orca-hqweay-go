# 📌 Pinned Blocks

A tool that lets you "pin" important blocks to the editor sidebar for one-click side-panel access.

## ✨ Features

- **Tag-driven**: Add the configured tag (default: `#置顶`) to any block to pin it.
- **displayName support**: Set a `displayName` property on the tag to customize the display name in the panel (same pattern as the Random Walk plugin).
- **Sidebar Button**: Registers a 📌 pin icon in the right editor sidebar.
- **Hover Preview**: Hovering over the pin icon shows a floating list of all pinned blocks.
- **Last-opened memory**: Left-click the pin button to directly reopen the last accessed block in a side panel. Right-click to open the full selection list.
- **Visual highlight**: The last-opened block is highlighted in the list (filled pin icon + "Last" badge).
- **Custom Tag Name**: Change the pin tag name from the plugin settings.

## 🚀 Usage

1. Enable the **Pinned Blocks** plugin in Sub-plugin Settings.
2. Add the `#置顶` tag to any block you want to pin (customizable in settings).
3. (Optional) Click the tag and set `displayName` in the properties panel to a friendly name (e.g., "Project Nav").
4. Find the 📌 icon in the right editor sidebar:
   - **Hover**: See all pinned blocks; click any to open it in a new panel to the right.
   - **Left-click**: Directly reopen the last accessed block.
   - **Right-click**: Open the full list to choose a block.
