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
- **CSV Import**: Import CSV data as note blocks.

### 4. 🧹 Remove Style
Quickly clean up note content formatting:
- **Remove Inline Styles**: Clear rich text styles like bold, highlight, etc.
- **Remove Links**: Convert links to plain text.
- **Remove Spaces**: Delete empty lines (without children).

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

### 7. 🏪 Plugin Bazaar
The community plugin marketplace for Orca, discover more possibilities:
- **Browse & Install**: Browse and one-click install community plugins directly within the app.
- **Auto Management**: Supports plugin updates and uninstallation.
- **Contribute**: Developers are welcome to submit their plugins to the bazaar.

### 8. 🏷️ Quick Tag Shortcuts
Boost your tagging efficiency with custom shortcuts:
- **Smart Tagging**: Use placeholders or multiple tags in a single shortcut.
- **Native Integration**: Leverages Orca's native tag API for reliability.
- **Auto Formatting**: Ensures tags are correctly formatted with leading `#`.

## Development

This project uses a modular architecture:
- `src/lets-*`: Each directory corresponds to a sub-plugin.
- `BasePlugin`: All plugins inherit from a base class, managing loading, unloading, and logging uniformly.
- `main.tsx`: Responsible for dynamically loading all sub-plugins.

## License

WTFPL
