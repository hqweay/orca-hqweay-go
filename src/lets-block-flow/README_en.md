# 📤 Block Flow

An efficiency tool that allows you to quickly and elegantly transfer block contents across pages via the block context menu.

## ✨ Features

- **Multi-target Transfer**:
  - 📅 **Today's Journal** — Today's Daily Note page.
  - 🌅 **Tomorrow's Journal** — Tomorrow's Daily Note page (perfect for task deferrals or planning tomorrow's tasks).
  - 📥 **Custom Inbox** — A tag-based inbox page (default tag: `#收件箱` / `#Inbox`) which is searched or auto-created when sending.
- **Two Transfer Modes**:
  - ✂️ **Move** — Physically cut and move the selected blocks to the end of the target block.
  - 🔗 **Send Ref** — Leave the original blocks untouched, only inserting a block reference (`{ t: "r", v: blockId }`) under the target block. Perfect for referencing tasks or notes dynamically.
- **Multi-select Support**: Allows selecting multiple blocks to batch-transfer/reference them at once.
- **Customizable Settings**: Turn specific options on/off or change the Inbox tag from the Sub-plugin settings panel.

## 🚀 Usage

1. Enable the **Block Flow** plugin in Sub-plugin Settings.
2. In any document, select one or more blocks, and right-click to open the block context menu.
3. Find the action items at the bottom (e.g., `Move to Today`, `Send Ref to Inbox`).
4. Click to instantly transfer or reference the blocks. A beautiful success notification will appear at the top-right.
