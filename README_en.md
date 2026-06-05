# Orca HQWEAY Go: Dino Toolbox

**English** | [中文](./README.md)

This is a collection of enhanced plugins for Orca Note, providing a suite of practical tools to improve your note-taking experience.

## Usage

1.  Download the Release package, `package.zip`.
2.  Unzip it and copy the folder to the `plugins` directory of Orca Note.

## Features

This plugin collection includes the following sub-plugins, which can be individually enabled or used in settings:

### 1. 📝 Format Block

Standardize the text format of the current block and its children:

- Automatically correct Chinese/English punctuation.
- Optimize spacing between Chinese and English text.
- Normalize full-width/half-width characters.

### 2. 🎙️ VoiceNotes Sync

Synchronize recordings from [VoiceNotes](https://voicenotes.com/) to Orca Note:

- Supports incremental and full synchronization.
- Automatically archives to a specified "VoiceNotes Inbox".

### 3. 📂 Import Tools

- **Folder Import**: Bulk import Markdown files from folders.
- **CSV Import**:
  - **Multi-Template Mapping**: Configure multiple tag templates for the same CSV file.
  - **Smart Parsing**: Automatically handles complex properties like DateTime and TextChoices.
  - **Dual Insertion**: Supports importing to specific pages or directly into Daily Notes.

### 4. 🧹 Remove Style

Quickly clean up note content formatting:

- **Remove Inline Styles**: Clear rich text styles like bold, highlight, etc.
- **Remove Links**: Convert links to plain text.
- **Remove Spaces**: Delete empty lines (without children).
- **Convert to Auto Headings**: Uniformly convert all levels of headings within the note to automatic hierarchy headings.

### 5. 🔃 Sort Blocks

Intelligently sort selected multiple blocks:

- **Configurable Order**: Support custom sorting rules (Default: Empty -> Normal -> Completed -> Uncompleted).
- **Dictionary Sort**: Sort items of the same type alphabetically by text content.
- **Multi-select Trigger**: Context menu appears only when 2 or more blocks are selected.

### 6. 📤 Publish to GitHub

One-click publish Orca notes as Markdown blog posts:

- **Image Hosting Integration**: Automatically extract images and upload to a specified GitHub repo (supports deduplication).
- **Blog Deployment**: Push Markdown content to blog repositories (compatible with Hexo/Jekyll/Hugo, etc.).
- **Smart Metadata**:
    - Automatically generates Frontmatter.
    - Records `github_url` and `blog_url` (clickable).
    - Automatically maintains `publish_date` creation time.
    - Only effective for Page Blocks.
- **Poetry Mode**:
    - **Compact Formatting**: Triggered by tag, compresses double newlines to single newlines.
    - **Hard Breaks**: Automatically appends two spaces to each line to ensure standard Markdown hard breaks.

### 7. 🏪 Plugin Bazaar

The community plugin marketplace for Orca, discover more possibilities:

- **Browse & Install**: Browse and one-click install community plugins directly within the app.
- **Auto Management**: Supports plugin updates and uninstallation.
- **Custom Source**: Supports configuring a custom URL source for the `plugins.json` list via Plugin Settings. 
- **Contribute**: Developers are welcome to submit their plugins to the bazaar.

### 8. 🏷️ Quick Tag Shortcuts

Boost your tagging efficiency with custom shortcuts:

- **One-Click Tagging**: Configure shortcuts for frequently used tags to insert at the cursor instantly.
- **Default Properties**: Automatically attach properties (e.g., status, priority) with multi-select merging support.

### 9. 🌳 Heading Tree 🥰 [SaXz2](https://github.com/SaXz2)
Intelligently reorganize document structure based on heading hierarchy:

- **Auto Level Detection**: Smart recognition of H1-H4 heading hierarchy relationships.
- **Sibling Preservation**: Same-level headings maintain their sibling relationship without incorrect staircase indentation.
- **Smart Movement**: Only moves blocks that need adjustment; blocks already in correct positions remain unchanged.
- **Text Attribution**: Plain text blocks automatically become children of the nearest heading.
- **Level Gap Handling**: Supports missing intermediate levels (e.g., H1 → H3).

- **Level Gap Handling**: Supports missing intermediate levels (e.g., H1 → H3).

### 10. 🌐 Web Assistant

An all-in-one web enhancement tool combining **Metadata Extraction**, **Internal Browsing**, and **Content Clipping**:

-   **Smart Extraction**:
    -   **Auto Mode**: One-click extract link metadata (title, cover, summary) to create beautiful cards.
    -   **Rule Engine**: Built-in rules (e.g., Douban) and support for custom JavaScript extraction scripts.
-   **Internal Browser**:
    -   **Seamless Browsing**: Open web pages directly within the note app, no need to switch windows.
    -   **Force Navigation**: Automatically handles `target="_blank"` redirection to keep you in the current window.
    -   **Quick Access**: Custom shortcuts for frequently used sites (Google, Wiki, etc.).
-   **Web Clipper**:
    -   **WYSIWYG Clipping**: Select text in the browser, right-click, and **"Save to Daily Note"** instantly.
    -   **Markdown Engine**: Automatically converts HTML to Markdown (preserving headers, links, bolding, etc.).
    -   **Structured Clipping**: Creates a "Bookmark Block" (with title, link, cover, tags) and inserts content as nested child blocks.
    -   **Interactive Extraction**: Handles pages requiring login or dynamic loading.
-   **Mobile Simulation**:
    -   One-click switch to mobile User Agent for a cleaner, reading-friendly layout (optimized for sites like Douban).
-   **Flexible Config**:
    -   Supports top-bar customization (Standalone button or Actions menu).
    -   Supports inserting data into the current block or creating new blocks.

### 11. 🧠 Spaced Repetition (SRS)

An efficient tool for memory and knowledge exploration based on the FSRS algorithm:

- **FSRS Algorithm Integration**: Integrates [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) to intelligently schedule review tasks based on the forgetting curve.
- **Roaming Mode**:
  - **Contextual Roaming**: When starting a roam for a single block, it automatically collects subtree content, outgoing references, and backlinks to explore related knowledge while reviewing.
  - **Dynamic Query Roaming**: Directly converts real-time search results from Query blocks (e.g., "#bookmark") into a review task stream.
- **Seamless Conversion & Persistence**:
  - **Automatic Conversion**: Simply "Mark as Read" or "Grade" during roaming to automatically convert regular blocks into flashcards (attaches `#Card` tag).
  - **Comprehensive Tracking**: Supports saving remarks, flagging, and switching statuses (Archive/Suspend).
- **Optimized Interaction**:
  - **Multi-Format Support**: Supports both Question-Answer mode (Item) and immersive reading mode (Topic).
  - **Intuitive Handling**: Supports shortcuts (Space, Numbers 1-4), one-click Undo (Z key), and reverting review progress.
- **Full i18n Support**: Native English and Chinese localization, including time interval displays (e.g., "1d", "2.5mo").

### 12. 🪞 Embed Children

Optimize the display experience of "Mirror Blocks":

- **Dynamic Children Display**: Allows blocks with a specific tag to automatically display their children blocks when embedded as a mirror block in other pages.
- **Flexible Configuration**: Customize the exclusive tag name to trigger this feature via settings.
- **Seamless Styling**: Optimizes the indentation and list styles of the referenced tree block to make it look more natural in the current document's layout.

### 14. 🎲 Random Walk

A powerful tag-based random walk tool providing an exploratory experience for your knowledge base:

- **Zero-config Detection**: Add a walk tag (e.g., `#RandomWalk`) to any block, and it automatically becomes an independent random walk channel.
- **Dual Mode Support**:
  - **Query Blocks**: Utilizes the native random engine to deal cards, ensuring no duplicate traversals.
  - **Normal Blocks**: Automatically retrieves child nodes and performs a pure in-memory shuffle.
- **Custom Naming**: Customize the `displayName` property of the walk tag to display clean and organized channel names in the list.
- **Instant Walk via Context Menu**: Right-click any parent or query block to start a temporary walk immediately, no tagging required. The minimum number of child blocks required to show this option can be configured in settings.
- **Keyboard Shortcut Support**: Supports configuring a shortcut for "Random Walk" in settings.
- **Channel Memory**: The main button intelligently remembers the last walked channel (including temporary ones).

### 15. 📋 Smart Clipboard Injection

Empower the clipboard with JSON structure parsing, instantly transforming external formatted data into native Orca note nodes:

- **Standard Format Support**: Parses and inserts `{ type: "orca-tags", tags: [...], content: ... }` formatted data from the clipboard.
- **Custom Shortcuts**: Configure independent shortcuts for instant clipboard content conversion.
- **Rich Text Support**: Insert text fragments (`ContentFragment`) with links or formatting alongside tags.
- **Deduplication Check**: Configure deduplication rules via `primaryKey` (string or tag map) to prevent duplicate insertions intelligently.
- **Remote Image Downloading**: Support `downloadImages: true` configuration to automatically fetch and save remote images to local assets.

```json
{
  "type": "orca-tags",
  "content": [
    { "t": "t", "v": "Check our " },
    { "t": "l", "v": "Orca Documentation", "l": "https://orca.so/docs" }
  ],
  "primaryKey": {
    "Task Tag": "Reference Link"
  },
  "downloadImages": true,
  "tags": [
    {
      "Task Tag": [
        {
          "name": "Status",
          "type": 6,
          "value": ["In Progress", "High Priority"]
        }
      ]
    }
  ]
}
```

### 16. ⌨️ Editor Commands

Provides a collection of enhanced commands beyond the native editor capabilities:

- **Copy Text as Block Ref (JSON)**: Select a piece of text and instantly convert it into a reference pointing to the current block (using the selected text as its alias). It writes the result as a JSON payload to the clipboard. 
- **Synergy**: Perfectly combined with the `Smart Clipboard Injection` plugin, you can paste the generated JSON anywhere to achieve lightning-fast cross-page block reference insertion.
- **Custom Shortcuts**: Configure dedicated shortcuts for these operations directly in the settings panel.

### 17. 🛠️ Block Tools

Enhance block context menu operations, specifically for advanced workflow of "Reference Blocks":

- **Push Children to Source**: Move children under the current reference block to its source block, keeping the reference intact.
- **Push Children and Delete**: Push children to source and delete the current reference block (useful for cleaning up temporary proxy pages).
- **Push Children and Keep Trace**: Move children to the source, convert the current reference block to plain text (keeping alias), and insert new references pointing to the moved children under the source block, achieving "Data Archived, Trace Maintained".
- **Move to Top/Bottom of Parent**: Quickly move selected blocks to the very beginning or end of their parent block for easier layout arrangement.
- **Two-way Reference & Link Conversions**:
    - **Convert Block Reference to Block Link**: Convert block references (`((block-id))`) to hyperlinks (`[text](orca://block/block-id)`), fetching source text if no alias is set.
    - **Convert Block Reference to Text Pin (文本📌)**: Append `📌` to the alias or text representation, making it a text pin reference.
    - **Convert Block Reference to Pin (📌)**: Set the alias directly to `📌`, turning it into a pure icon pin reference.
    - **Convert Block Link to Block Reference**: Revert `orca://block/` hyperlinks back to native block references, preserving the label text as alias.
- **Batch Support**: Supports selecting multiple blocks to execute the logic in bulk.
- **Config Management**: Support for enabling or disabling these features independently in the settings panel.

### 18. 🔒 Privacy Block

A minimalistic yet effective privacy protection tool that hides sensitive content from AI using the underlying converter mechanism:

- **Intercept AI Context**: When AI requests notebook context, searches, or summarizes, it will only read `[🔒 Privacy Content Hidden]`.
- **Native Editing Experience**: Privacy blocks retain all native rich text editor features, including bolding, highlighting, and child block nesting, without disrupting your writing flow.
- **Password-Free & Unintrusive**: No annoying password prompts or encryption/decryption waiting times. Toggle it with a single click.
- **Visual Hints**: A prominent red indicator bar and a lock icon appear on the left of privacy blocks, clearly showing their status.

### 19. 🌊 Block Flow

Quickly send blocks to designated target locations, saying goodbye to tedious drag-and-drop or cut-and-paste:

- **Send to...**: Provides a clean, collapsible sub-menu in the context menu that opens a dedicated popup for flow options upon click.
- **Smart Target Recognition**: Supports one-click moving or referencing blocks to "Today's Journal", "Tomorrow's Journal", or a preset "Inbox".
- **Foolproof Design**: Automatically detects if the selected blocks contain a Journal block (using the official `getRepr` API). If detected, it automatically hides the flow menu to prevent accidental destruction of core journal pages.

### 20. 📌 Pinned Blocks

A tag-based sidebar pinned panel for quick access to your frequently used core notes:

- **One-Click Pinning**: Add the configured tag (default `#置顶` or `#Pin`) to any block to add it to the pinned list.
- **Quick Interaction**:
  - **Left-Click**: One-click reopen the **last opened pinned block** in the right sidebar, perfect for quickly switching back to your core workspace.
  - **Right-Click**: Opens the full list of all pinned blocks for you to choose from.
- **Custom Naming**: Supports adding a `displayName` property on the tag to customize how the block appears in the panel, keeping the list clean and organized.

## Development

This project uses a modular architecture:

- `src/lets-*`: Each directory corresponds to a sub-plugin.
- `BasePlugin`: All plugins inherit from a base class, managing loading, unloading, and logging uniformly.
- `main.tsx`: Responsible for dynamically loading all sub-plugins.

**For more development details and common pitfalls, please check: [Development Experience](./docs/dev-learnings.md)**
