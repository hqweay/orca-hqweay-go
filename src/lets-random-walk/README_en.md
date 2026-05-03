# 🎲 Random Walk

A powerful tag-based random walk tool for Orca Note.

## ✨ Features

- **Zero-config Detection**: Add a walk tag (e.g., `#RandomWalk`) to any block, and it automatically becomes an independent random walk channel.
- **Dual Mode Support**:
  - **Query Blocks**: Utilizes the native random engine to deal cards, ensuring no duplicate traversals.
  - **Normal Blocks**: Automatically retrieves child nodes and performs a pure in-memory shuffle.
- **Custom Naming**: Customize the `displayName` property of the walk tag to display clean and organized channel names in the list.
- **Instant Walk via Context Menu**: Right-click any parent or query block to start a temporary walk immediately, no tagging required.
- **Keyboard Shortcut Support**: Supports configuring a shortcut for "Random Walk" in settings for seamless exploration.
- **Channel Memory**: The main button intelligently remembers the last walked channel (including temporary ones), allowing you to resume with a single click.

## 🚀 Usage

1. Enable the **Random Walk** plugin in Orca Note Settings -> Sub-plugin Settings.
2. Add `#RandomWalk` (customizable in settings) to any block you want to walk (e.g., a query block for "bookmarks" or a parent block with quotes).
3. If you want a nicer name in the dropdown, click the tag and set the `displayName` property in the property panel (e.g., "Favorite Quotes").
4. Click the 🎲 dice icon in the Headbar to roam your last viewed channel, or hover over the icon to switch channels.
5. **Temporary Walk**: Right-click any block of interest and select "Random Walk" to start exploring its contents immediately. The dice icon will automatically remember and lock onto this block.
