# Development Learnings & Pitfalls

## VoiceNotes Integration

### API Endpoints
- **General API vs Sync API**:
  - General operations (Create `POST`, Update `PATCH`) should use `https://api.voicenotes.com/api`.
  - Sync operations (Fetch `GET`) use `https://api.voicenotes.com/api/integrations/obsidian-sync`.
  - Using the wrong base URL results in 404s.

### Date Handling
- **Daily Notes**:
  - VoiceNotes stores timestamps in UTC (e.g., `created_at`).
  - When grouping into Daily Notes, **user's local time** must be used.
  - `new Date(utcString)` automatically converts to local time in browser environment.
  - Constructing the daily note requires explicit local year/month/day extraction to avoid UTC shifting (e.g., late night notes appearing in the "wrong" previous day if treated as UTC).

### Text Processing
- **HTML Entities**:
  - VoiceNotes transcripts often contain `<br>`, `&nbsp;`, and other HTML entities.
  - These must be cleaned before inserting into Orca blocks to avoid raw HTML rendering.
  - **Custom `cleanText`**: Used a regex-based cleaner to handle `<br>` to `\n` conversion and entity decoding.

## Orca Plugin Development

### File System Access API (`showDirectoryPicker`)
- **Pitfall**: `window.showDirectoryPicker()` 在 Chromium 中要求**必须由用户手势触发**（点击/键盘等）。如果在一串 `await`（例如网络下载、解压）之后再调用，会偶发/稳定报错：`SecurityError: Must be handling a user gesture to show a file picker.`
- **Fix**: 把目录选择放到用户点击行为的最开始（同一个点击回调里立刻调用），拿到 `DirectoryHandle` 后再执行后续异步下载/写入流程。

### Queries (Backend)
- **Tag Queries (`kind: 4`)**:
  - By default, tag queries might include **descendants** (children of the tagged block).
  - **Pitfall**: Querying for a block with `noteTag` and a specific `ID` property returned noise.
  - **Fix**: Set `includeDescendants: false` in the `QueryTag` condition.
  - **Property Types**: When filtering by property, specifying `type: 1` (Text) ensures strict matching and avoids potential mismatches with other property types.

### Publishing Flow
- **Markdown Generation**:
  - Generated Markdown often includes the block's text as the first line/heading.
  - **Title Extraction**: Reliable extraction involves taking the first line of the generated markdown (stripping `#`), rather than relying on `block.text` or `aliases` which might be out of sync.
  - **Content Cleanup**: After extracting the title from line 1, line 1 should be removed from the body to prevent title duplication in the published post.

### Quick Tag Shortcuts & API
- **Valtio Subscription**:
  - **Pitfall**: In the current plugin architecture, subscribing to `orca.state.plugins[name].settings` via Valtio may become unstable if the settings object is completely replaced by the system during save. This can cause the subscription to stop triggering.
  - **Solution**: For critical/stable settings updates, consider manual triggers or ensuring the subscription target remains stable.
- **Tag Insertion API**:
  - **`core.editor.insertTag`**: This API is preferred for inserting tags. It takes `(cursor, blockId, tagName)` and handles the internal tag referencing and formatting more reliably than manual fragment insertion.
  - **Note**: `tagName` should ideally start with `#`.
