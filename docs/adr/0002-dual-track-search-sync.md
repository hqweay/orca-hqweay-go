# 2. Dual-Track Search Sync

Date: 2026-06-26

## Status

Accepted

## Context

In the frontend UI (specifically sidebars rendering block trees or search results), users expect instant (0ms) feedback when modifying a block (e.g., converting a heading to text, which might filter it out of the current view). Relying on the backend to update the database and then re-fetching the entire block tree causes unacceptable latency and wastes performance.

However, using a purely static frontend cache (`searchCache`) leads to stale data, as users might edit the block directly in the main editor pane, which silently desyncs the cache.

## Decision

We implemented a "Dual-Track" architectural pattern to synchronize search results and block state across the UI:

1. **Local Cache Hijack (Instant UI Update)**:
   - The moment a user action occurs (e.g., in the sidebar), we directly mutate the in-memory `searchCache.tree`'s `block.properties` array.
   - We increment a `searchTrigger` counter within the Valtio Proxy. This forces the UI components to execute a purely in-memory O(N) secondary search/filter against the hijacked cache, instantly updating the UI without a network request.

2. **Live Data Interception (Global Consistency)**:
   - To account for implicit updates coming from the main editor, the search traversal logic intercepts lookups: `const block = orca.state.blocks[cachedBlock.id] || cachedBlock;`.
   - By prioritizing the live data object (`orca.state.blocks`) maintained by the editor, the UI perfectly captures cross-panel modifications while falling back to the cache when the block is not loaded in the editor.

## Consequences

- **Pros**: Achieves 0ms visual feedback for user actions while maintaining absolute data consistency with the main editor, regardless of where edits originate.
- **Cons**: Adds complexity to the rendering loop. UI components must be designed to properly respond to the `searchTrigger` proxy changes rather than just fetching data sequentially.
