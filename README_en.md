# Orca HQWEAY Go

**English** | [中文](./README.md)

A collection of power-user plugins for [Orca Notes](https://github.com/hqweay/orca-notes), built with a modular architecture.

## Included Plugins

### 1. VoiceNotes Sync (`lets-voicenotes-sync`)
Two-way synchronization with [VoiceNotes.com](https://voicenotes.com).
- **Features**: Sync recordings to Daily Journal, handle Subnotes/Attachments, push blocks to VoiceNotes.
- [Read documentation](./src/lets-voicenotes-sync/README.md)

### 2. Publish to GitHub (`lets-publish`)
Turn your notes into a blog.
- **Features**: One-click publish to Jekyll/Hexo/Hugo repos, auto image hosting, smart updates.
- [Read documentation](./src/lets-publish/README.md)

### 3. Import Tools (`lets-import`)
- **Features**: CSV Import support for bulk data migration.

### 4. Format Tools (`lets-format`)
- **Features**: Text cleaner, space handling for Chinese/English mixing.

### 5. Sort Tools (`lets-sort`)
- **Features**: Sort child blocks alphabetically.

### 6. Orca Bazaar (`lets-bazaar`)
- **Features**: Community plugin marketplace. Browse, install, and update plugins directly within Orca.
- [Read documentation](./src/lets-bazaar/README.md)

## Development

See [Development Learnings](./docs/dev-learnings.md) for technical details and API pitfalls encountered during development.

## Installation

Clone this repository into your Orca Notes plugins directory.

```bash
cd /path/to/orca/plugins
git clone <repo-url> orca-hqweay-go
pnpm install
pnpm build
```
