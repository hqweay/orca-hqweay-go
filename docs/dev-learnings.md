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
