## [1.9.3](/compare/v1.9.2...v1.9.3) (2026-01-31)


### Bug Fixes

* Synchronize plugin settings UI state upon plugin prop changes and include plugin name in settings persistence logs. 5c655fd


### Features

* add "Format Block" tooltip to the refresh button in the format plugin. ccc6c9f



## [1.9.2](/compare/v1.9.1...v1.9.2) (2026-01-31)


### Features

* Implement a custom context menu in the browser modal to save selected text to the daily note. dc879e7
* rename 'Link Metadata' to 'Web Assistant' and introduce web clipping, internal browsing, and enhanced metadata extraction. 32258ae



## [1.9.1](/compare/v1.8.4...v1.9.1) (2026-01-31)


### Features

* Automatically insert extracted link content into empty blocks and disable cover download for Douban rules. 1bcff85
* distinguish between input URL and active webview URL for explicit navigation. 28a0784
* Enforce global mode for browser opening and update event handlers to be async. 77b3377
* Force `target="_blank"` links within the webview to navigate in the current view. 3f4356f
* implement browser demo plugin featuring a webview modal for browsing and extracting Douban book metadata. a2b85c7
* Implement headbar integration for the browser modal with configurable display modes and reorder settings sections. 1965c06
* implement link metadata extraction module with configurable rules and a browser modal, updating translations. b12a863
* introduce quick links functionality with settings management and display in the browser modal. e46e1c3
* Pass the matched rule to the metadata extraction callback for dynamic block metadata application. c85ba7f
* Update BrowserModal styling with a blurred background, fixed dimensions, and hardcoded visible state. a2a7323
* Update default Douban quick link to a general search URL and name. 0091b0c
* 格式化中英文混排 eaaa754



## [1.8.4](/compare/v1.8.3...v1.8.4) (2026-01-28)


### Features

* Implement automatic image downloading and local asset conversion for tag properties. eeee8c5
* Update deduplication logic to support object-based primaryKey configuration for tag-specific property mapping.feat: Update deduplication logic to support object-based primaryKey configuration for tag-specific property mapping. 0c03c34



## [1.8.3](/compare/v1.8.2...v1.8.3) (2026-01-28)


### Features

* Add block deduplication during import using a primary key, updating example JSON and documentation. 3c7cf0e
* Allow CSV import to create root blocks when no target block is specified. e93e138
* group CSV block imports using `invokeGroup` and set URL link text to the first column's value. f66445d
* Introduce `removeFolder` for plugins, `QueryConditionsBuilder` component, `showBlockPreview` utility, `hasContent` and `hasRefs` query properties, and refine `after` command documentation. a3a40e9
* update and enhance formatting utilities b310295



## [1.8.2](/compare/v1.8.1...v1.8.2) (2026-01-27)


### Features

* Add active panel reorganization, configurable headbar button, and a new `getBlocks` utility function. ec352c5
* Introduce a test block plugin and conditionally load test plugins only in development mode. 6130b47
* only show heading tree menu when two or more blocks are selected 5da71a5
* Standardize plugin headbar button rendering and settings management with a new PluginSettings component. d9ab644



## [1.8.1](/compare/v1.8.0...v1.8.1) (2026-01-27)


### Reverts

* remove AGENTS.md content merger from rules 11fb97f



# [1.8.0](/compare/v1.6.4...v1.8.0) (2026-01-27)


### Features

* Add `pinyin-pro` dependency and configure `esbuild` for build optimization; fix: Correct project name typos and update package version. 16d477c
* Enhance slug generation with pinyin conversion, refine empty block deletion, and update dependencies and build configurations. c3452db



## [1.6.4](/compare/v1.6.3...v1.6.4) (2026-01-25)



## [1.6.3](/compare/v1.6.2...v1.6.3) (2026-01-25)



## [1.6.2](/compare/v1.6.1...v1.6.2) (2026-01-25)


### Features

* Introduce a new `DataImporter` utility for structured block and tag imports, and refactor the CSV import functionality into a dedicated `_csv` module. d186ec1
* Map CSV content to support links or plain text and remove data importer debug logs. 1c048d5
* Refactor CSV import modal with new configuration types, move components to `_csv` directory, and introduce a `DataImporter` utility. 0488cb0



## [1.6.1](/compare/v1.6.0...v1.6.1) (2026-01-25)


### Features

* Document multi-select tag pattern and update example JSON with diverse tag types including multi-select, progress, boolean, link, and image. 3452562



# [1.6.0](/compare/v1.5.5...v1.6.0) (2026-01-25)


### Features

* Add 'remove all styles' menu option, enhance 'remove all' button to include empty line removal, and refactor style/link removal logic for immutability. 5911e59
* Add advanced quick tag shortcut features and document best practices for tag and multi-select property insertion. 1f76e18
* Add command to paste structured tags from clipboard and improve TextChoices property handling. 06da82d
* Add configurable global shortcut for pasting tags from the clipboard, update settings UI to manage it, and add corresponding translations. 309bdd3
* Allow configuring and applying default properties to tags inserted via shortcuts. 0e7d757
* implement link metadata extraction with configurable rules and settings UI. 543d0ca
* Implement rich text insertion for `lets-shortcuts` through a new `text` field in the JSON payload, utilizing `core.editor.insertFragments`, and update documentation. 04b0469



## [1.5.5](/compare/v1.5.4...v1.5.5) (2026-01-24)



## [1.5.4](/compare/v1.5.3...v1.5.4) (2026-01-24)



## [1.5.3](/compare/v1.5.2...v1.5.3) (2026-01-24)



## [1.5.2](/compare/1.5.1...v1.5.2) (2026-01-24)



## [1.5.1](/compare/1.5.0...1.5.1) (2026-01-23)



# [1.5.0](/compare/1.4.0...1.5.0) (2026-01-23)


### Bug Fixes

* Remove success notification after saving settings in ShortcutsSettings component to streamline user experience af51fa8
* Set default value for excludeTags in VoiceNotesSettings to 'orca' for improved user experience b7eda9f


### Features

* Add headbar menu items for Format and RemoveStyle plugins to enhance user interaction with new formatting options 234abad
* Add new translations for VoiceNotes and formatting options in zhCN, enhancing user experience and interaction with the plugins dcf42ac
* Add preIcons to menu items in Import and VoiceNotesSync plugins for improved visual cues 64b9421
* Enhance BazaarModal with release information fetching and installation confirmation flow 27e0ec2
* Implement Bazaar settings component and integrate headbar display mode options for enhanced user customization 4394ca0
* Implement custom settings architecture for sub-plugins and enhance tag shortcuts management 19421dd
* Implement headbar menu items for Import and VoiceNotesSync plugins, enhancing user interaction with new action buttons ce16808
* Integrate headbar settings for Format and RemoveStyle plugins, allowing users to customize display modes and enhance interaction ee526db



# [1.4.0](/compare/1.3.6...1.4.0) (2026-01-23)



## [1.3.6](/compare/1.3.5...1.3.6) (2026-01-23)


### Bug Fixes

* Ensure user gesture triggers file system access in Bazaar modal installation process 4fce960


### Features

* Add search functionality to Bazaar modal for filtering plugins 36e8277
* Enhance user notification for plugin directory selection in Bazaar modal c378d24



## [1.3.5](/compare/1.3.4...1.3.5) (2026-01-22)



## [1.3.4](/compare/1.3.3...1.3.4) (2026-01-22)



## [1.3.3](/compare/1.3.2...1.3.3) (2026-01-22)



## [1.3.2](/compare/1.3.1...1.3.2) (2026-01-22)



## [1.3.1](/compare/1.3.0...1.3.1) (2026-01-22)


### Features

* Add download progress tracking and display for plugin installation in the Bazaar modal. 08c6121
* Add GitHub repository link next to the repository name in the Bazaar modal. cd7ee2c
* Implement plugin list caching and add a GitHub link and refresh button to the Bazaar modal. 6dd2c00



# [1.3.0](/compare/1.2.3...1.3.0) (2026-01-22)


### Features

* Broaden zip asset detection and enhance file extraction robustness by skipping system files, invalid filenames, and gracefully handling write errors. aaf57bb
* implement Orca Bazaar for browsing and installing plugins with `jszip` dependency e6f2027



## [1.2.3](/compare/1.2.2...1.2.3) (2026-01-22)


### Features

* Add `preIcon` to "Publish to GitHub" and "Sort Selected Blocks" menu items. 7eee95d
* add exclude tags setting, manual block sync to VoiceNotes, and improve date handling for voice note synchronization. ca84c0b
* Add functionality to create and tag voice notes, and introduce new API routes for these operations. 3add503
* Extract title from the first line of generated markdown content and remove it from the body. ce0e252
* Group synced attachments under a new 'Attachments' heading block. 7ac7594
* Reorder creation and transcript processing, introduce HTML to Markdown conversion, and structure transcript and creation titles as headings. cdba3f0



## [1.2.2](/compare/1.2.1...1.2.2) (2026-01-21)


### Features

* Restructure build output to `build/dist` and add static asset copying for `icon.png`, `README.md`, and `LICENSE`. 1caba1d



## [1.2.1](/compare/1.2.0...1.2.1) (2026-01-21)


### Features

* Enable publishing for all blocks, refine title and publish date property generation, and update logger's development environment detection. 5d58363
* Pass additional `undefined` and `true` arguments to the `renderBlock` function call. 07cab6c



# [1.2.0](/compare/1.1.2...1.2.0) (2026-01-19)


### Bug Fixes

* Quote date and updated fields in frontmatter and remove unused `now` variable. f3feac7


### Features

* Add 'Publish to GitHub Plugin' README and update developer experience documentation. e349429
* Add a plugin to publish Orca blocks to GitHub, managing markdown, images, and block properties, and update an agent rule. 1f36026
* enhance publish feature by adding blog domain setting and storing publish date, GitHub URL, and blog URL as properties on published tags. 6134623
* Hide the "Sort Selected Blocks" menu item when one or zero blocks are selected. 789a154
* make the published tag label configurable through settings 66707c4
* Optimize image uploads by reusing existing files and using original filenames, and update `getFileSha` to return full file data. a734bda
* Restrict the "Publish to GitHub" menu item to only appear for top-level blocks. 08a3504
* Rework publish plugin to track posts via `github_url`/`blog_url` properties, preserve `publish_date`, and add configurable tag label and blog domain. 10b472e
* set logger global level to DEBUG in development and ERROR in production b2dd018



## [1.1.2](/compare/1.1.1...1.1.2) (2026-01-19)



# [1.1.0](/compare/1.0.12...1.1.0) (2026-01-19)


### Features

* Dynamically prefix plugin settings keys and labels and add new developer experience documentation. dbcc875
* introduce a plugin to sort selected blocks by task status and text content, and remove AI documentation. 5b23781
* Introduce configurable block sort order through plugin settings and refactor sorting logic to prioritize block types. 0b6d24b



## [1.1.1](/compare/1.1.0...1.1.1) (2026-01-19)



# [1.1.0](/compare/1.0.12...1.1.0) (2026-01-19)


### Features

* Dynamically prefix plugin settings keys and labels and add new developer experience documentation. dbcc875
* Format imported content and adjust asset paths, and remove unused import dialog state. 8ee4841
* introduce a plugin to sort selected blocks by task status and text content, and remove AI documentation. 5b23781
* Introduce configurable block sort order through plugin settings and refactor sorting logic to prioritize block types. 0b6d24b



## [1.0.12](/compare/1.0.11...1.0.12) (2026-01-18)


### Features

* Add option to remove empty lines in `lets-remove-style` plugin, refactor its menu text and notifications, update Vite config for path resolution, and remove CSV test files. c8c8dee



## [1.0.11](/compare/1.0.10...1.0.11) (2026-01-18)



## [1.0.10](/compare/1.0.9...1.0.10) (2026-01-18)



## [1.0.9](/compare/1.0.8...1.0.9) (2026-01-18)



## [1.0.8](/compare/1.0.7...1.0.8) (2026-01-18)



## [1.0.7](/compare/1.0.6...1.0.7) (2026-01-18)



## [1.0.6](/compare/1.0.5...1.0.6) (2026-01-18)



## [1.0.5](/compare/1.0.4...1.0.5) (2026-01-18)



## [1.0.4](/compare/1.0.3...1.0.4) (2026-01-18)



## [1.0.3](/compare/1.0.2...1.0.3) (2026-01-18)



## [1.0.2](/compare/1.0.1...1.0.2) (2026-01-18)



## [1.0.1](/compare/1.0.0...1.0.1) (2026-01-18)



# [1.0.0](/compare/e18863181872aed16a77d9fd1204ea7d06c6c25d...1.0.0) (2026-01-18)


### Bug Fixes

* Ensure only pure text blocks are formatted and include the root block in processing. f87daeb


### Features

* Add a boolean setting for each sub-plugin to enable or disable its loading. aa447d3
* Add a new `lets-format` plugin, refactor `lets-voicenotes-sync` to use a `getSettingsSchema` function with prefixed settings, and update the main plugin loader to collect and set sub-plugin settings schemas. c8f6ba1
* Add a plugin to remove block styles, enable full voice note synchronization with title cleaning, and include "App" in standard names. 8765b79
* Add a plugin to remove inline styles and links, enhance voice note sync by removing limits and cleaning titles, set default log level to debug, and update standard names. 06f0661
* add Markdown and CSV import capabilities and a new formatting module. e188631
* Add notification for formatted blocks and refactor plugin name variable scope in voicenotes-sync. 84802f6
* Enable full voice note synchronization, clean note and creation titles, and disable block insertion in import. 7164d79



