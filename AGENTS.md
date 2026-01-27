# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

Orca Note (虎鲸笔记) plugin collection called "Dino Toolbox" (恐龙工具箱). A modular plugin architecture where each sub-plugin resides in `src/lets-*` directories.

## Build & Development Commands

```bash
# Development (watch mode with live reload)
npm run dev

# Production build (outputs to ./build/dist and creates package.zip)
npm run build
```

Note: The dev command outputs to a hardcoded macOS path (`/Users/hqweay/Documents/orca/plugins/...`). You may need to modify `vite.config.ts` if developing on a different machine.

## Architecture

### Plugin Loading System
- **Entry**: `src/main.tsx` - Uses `import.meta.glob("./lets-*/index.tsx")` to auto-discover and load all sub-plugins
- **Base Class**: `src/libs/BasePlugin.ts` - All sub-plugins extend this class, which handles:
  - Lifecycle (`load()`, `unload()`, `safeLoad()`, `safeUnload()`)
  - Settings management with debounced persistence (2s)
  - Localization via `t()` function
  - Plugin-scoped data storage via `getData()`/`setData()`

### Sub-plugins (`src/lets-*`)
Each sub-plugin exports a default class extending `BasePlugin`:
- `lets-format` - Text formatting (punctuation, spacing)
- `lets-voicenotes-sync` - VoiceNotes.com integration
- `lets-import` - Markdown folder and CSV import
- `lets-remove-style` - Style/link removal
- `lets-sort` - Block sorting
- `lets-publish` - GitHub Pages publishing
- `lets-bazaar` - Community plugin marketplace
- `lets-shortcuts` - Quick tag shortcuts
- `lets-heading-tree` - Reorganize flat blocks into tree structure by heading levels

### Core Libraries (`src/libs/`)
- `DataImporter.ts` - Unified data insertion layer for blocks, tags, and properties
- `l10n.ts` - Localization system
- `logger.ts` - Logging utility
- `consts.ts` - Constants including `PropType` enum

### Translations
Located in `src/translations/`. Use `t("key")` or `t("key", { var: value })` for localized strings.

## Orca Editor API Pitfalls

### Block Movement
Use `core.editor.moveBlocks` (plural), not `moveBlock`. Always pass an array of IDs:
```typescript
invokeEditorCommand("core.editor.moveBlocks", null, [blockId], refBlockId, "after")
```

### Task Block Identification
Tasks are identified via `properties._repr`:
```typescript
const reprProp = block.properties.find(p => p.name === "_repr");
const isTask = reprProp?.value?.type === "task";
const isCompleted = reprProp?.value?.state === 1;
```

### Tag Property Updates
`core.editor.insertTag` does NOT update existing `ref.data`. Use `core.editor.setRefData`:
```typescript
await invokeEditorCommand("core.editor.setRefData", null, existingRef, updatedProperties);
```

### Link Properties
Use `PropType.Text` with `typeArgs: { subType: "link" }` for clickable URLs.

### Proxy Objects
Always strip Valtio proxies before passing to backend:
```typescript
JSON.parse(JSON.stringify(proxyObject))
```

### File Picker Security
`window.showDirectoryPicker()` must be called immediately in a user gesture handler, not after async operations.

### GitHub API Caching
Add `?t=${Date.now()}` and `cache: "no-store"` to avoid stale 404 responses.

## Adding a New Sub-plugin

1. Create `src/lets-{name}/index.tsx`
2. Export a default class extending `BasePlugin`
3. Implement `load()` and `unload()` methods
4. Optionally override `getSettingsSchema()` for custom settings
5. Add translations in `src/translations/zhCN.ts`

The plugin will be auto-discovered and loaded by `main.tsx`.

## Orca Plugin API Reference

Official API documentation is in `orca-plugin-template/plugin-docs/` (git submodule):
- `documents/Quick-Start.md` - Lifecycle, settings, and examples
- `documents/Core-Editor-Commands.md` - Block manipulation commands
- `documents/Backend-API.md` - Data queries and backend operations
- `types/orca.md` - Type definitions

Run `git submodule update --init` if the directory is empty.
