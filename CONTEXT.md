# Ubiquitous Language (Domain Glossary)

This file serves as the strict domain dictionary for the Orca Note project. 
When communicating about features, designing architecture, or writing code, **always use these exact terms**.

## Core Editor Concepts

- **Block**: The fundamental unit of content in the Orca editor. Its textual content is not a plain string, but an array of `ContentFragment` objects.
- **ContentFragment**: The data structure representing text and rich media within a Block.
  - *Example (Text)*: `[{ t: 't', v: 'Hello World' }]`
  - *Example (Link)*: `[{ t: 'l', v: 'Display Text', l: 'URL' }]`
- **Task Block**: A specific type of block that behaves like a todo item. It is not identified by a top-level type, but by a property named `_repr` containing `{ type: "task" }` (or "todo", "checklist"). State `1` means completed.
- **Properties (`block.properties`)**: Key-value metadata attached directly to a block itself (e.g., block type, checked status).
- **Tag / Ref (`block.refs`)**: A reference link to another block (acting as a Tag). 
  - **Ref Data (`block.refs[].data`)**: Properties attached to the *relationship* between a block and a tag. Custom user metadata (like `slug`, `blog_path`) should be stored here on specific tags (like "#Published"), rather than polluting the core `block.properties`.

## Architecture & State Management

- **Sub-plugin (lets-\*)**: The mono-repo plugin architecture. Independent features are developed in `src/lets-[name]` directories, inheriting from `BasePlugin`, and are dynamically loaded by `src/main.tsx`.
- **Valtio Proxy**: The state management solution powering `orca.state`. 
  - *Critical Constraint*: Proxy objects cannot always be passed directly to `invokeEditorCommand` or backend calls due to cloning errors ("Illegal invocation"). They must be scrubbed using `cloneDeep()`.
- **Dual-track Search Sync**: The architectural pattern used in the frontend to achieve 0ms search feedback. It combines **Cache Hijack** (modifying the in-memory `searchCache.tree` proxy to trigger instant re-renders) with **Live Data Interception** (reading from `orca.state.blocks` instead of the cache during traversal to catch cross-panel edits).
- **Workspace Cache Isolation**: Persistent UI states (like `localStorage`) must namespace their keys with `orca.state.repo` to prevent data bleed between different user vaults.
- **LinkEvaluator**: A deep utility module in `lets-local-graph` that encapsulates references filtering logic (such as checking type parameters, blacklist exclusion lists, and user filter settings) behind a single functional evaluator seam.
- **FootprintSession**: An encapsulated React Hook interface (`useFootprintSession`) in `lets-local-graph` that hides state management (Valtio Proxy) internals from UI components and exposes unified commands for updating footprints, toggling filters, and manual node expansion.

## FSRS (Spaced Repetition)

- **FSRS**: Free Spaced Repetition Scheduler algorithm used for learning.
- **Item**: Flashcard semantics focusing on *Retention*. Ratings (Again/Hard/Good/Easy) measure memory recall.
- **Topic**: Note/Source material semantics focusing on *Processing/Digestion*. Ratings represent processing difficulty or scheduling (e.g., "In-depth/Hard" vs "Skim/Soon").
- **Global Weights**: The 17 FSRS parameters are stored in Global Settings rather than per-card to save space and enable global algorithmic optimization.

## CI/CD Workflow

- **Commit Flag Trigger**: The CI pipeline avoids race conditions by strictly using commit flags (e.g., `[update registry]`) to trigger sequential GitHub Actions, rather than relying on brittle `sleep` polling.
