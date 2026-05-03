## [2.3.5](/compare/v2.3.4...v2.3.5) (2026-05-03)

新增:随机漫步.打上标签的查询块和父块会被识别为随机漫步组,一键漫游;右键块菜单可临时漫游.


### Features

* add block menu command for random walks and improve group navigation logic 37aa49b

## [2.3.4](/compare/v2.3.3...v2.3.4) (2026-05-03)

## [2.3.3](/compare/v2.3.2...v2.3.3) (2026-05-03)

## [2.3.2](/compare/v2.3.1...v2.3.2) (2026-05-03)

## [2.3.1](/compare/v2.3.0...v2.3.1) (2026-05-03)

# [2.3.0](/compare/v2.2.0...v2.3.0) (2026-05-03)


### Features

* add documentation for the new Random Walk feature across README files cb4744a
* implement automatic schema synchronization for the random walk tag and add explanatory UI text ef68424
* implement RandomWalkPlugin for shuffled block and query navigation 2575ed8
* prioritize displayName property for group titles in random walk view ea9cd45
* update group title logic to prioritize query captions and shorten default block text preview 3e754ed

# [2.2.0](/compare/v2.1.4...v2.2.0) (2026-04-30)

## [2.1.4](/compare/v2.1.3...v2.1.4) (2026-04-30)

## [2.1.3](/compare/v2.1.2...v2.1.3) (2026-04-30)

## [2.1.2](/compare/v2.1.1...v2.1.2) (2026-04-29)

## [2.1.1](/compare/v2.1.0...v2.1.1) (2026-04-29)

# [2.1.0](/compare/v2.0.0...v2.1.0) (2026-04-29)


### Features

* add auto-heading conversion feature to style removal documentation 858f091
* add EmbedChildren plugin to dynamically style and indent mirrored block content 6c237ab
* implement embed children feature for mirror blocks and update localization and documentation 5a86f84
* migrate plugin styling to SCSS and add support for additional indentation levels 7f2e214

# [2.0.0](/compare/v1.14.6...v2.0.0) (2026-04-29)


### Bug Fixes

* prevent content formatting inside inline code blocks by checking fragment type 416f103
* 插入标签时过滤空属性字段，因为虎鲸的属性查询判空是通过有无属性字段来做的判断，而不是属性字段值是否为空做的判断 32a119a


### Features

* add functionality to convert headings to auto-headings via remove-style command 0a175c8

## [1.14.6](/compare/v1.14.5...v1.14.6) (2026-04-23)


### Features

* extract and sync transcript content from nested blocks during voice note synchronization 122b9a5

## [1.14.5](/compare/v1.14.4...v1.14.5) (2026-04-23)

## [1.14.4](/compare/v1.14.3...v1.14.4) (2026-04-23)

## [1.14.3](/compare/v1.14.2...v1.14.3) (2026-04-23)


### Features

* enable test sync time and add related notes rendering to note sync index e1ba975
* implement configurable include/exclude tag filtering for voice note synchronization c773a05
* implement subnote synchronization and update heading levels to dynamic values 0f27a16

## [1.14.2](/compare/v1.14.1...v1.14.2) (2026-04-18)


### Bug Fixes

* Ensure `isSaving` state resets in `ReviewCard` and prevent 'soon' graded cards from re-queuing in `ReviewPanel`. 9a22e19


### Features

* add pluginAsRoot parameter to listFiles method in orca interface f216586

## [1.14.1](/compare/v1.14.0...v1.14.1) (2026-03-23)


### Bug Fixes

* ensure saving state is always reset after card capture by moving `setIsSaving(false)` to a `finally` block. 2a6d99b


### Features

* Conditionally render SRS grade buttons and interval hints, and adjust the 'Soon' button's flex property based on `localIsVirtual`. 6b7fb8e
* Implement BFS-based roaming algorithm in core and introduce tiered loading for related blocks. b7b2e7d
* Implement SRS review modes (mixed, item, topic) selectable from a new headbar button. 67a0c69
* Make ReviewCard content conditionally editable based on `shortcutsEnabled`. 1391ee5
* Standardize SRS card grading options and interval prediction across card types and display modes, and pass grade to the completion handler. 76f64f2

# [1.14.0](/compare/v1.13.3...v1.14.0) (2026-03-19)


### Bug Fixes

* add cleanup to destroy Markmap instance on component unmount 98e2109


### Features

* add block utility functions for mirror ID resolution, ID validation, and deduplication. 58b7eca
* Add roaming review mode and refactor card behavior based on display mode (srs-item, srs-topic, roaming). c82292b
* Implement optimistic UI updates for card status and virtual state in `ReviewCard` and import `updateCardProperties`. ddaa6fc
* Implement topic-based scheduling with distinct review card UI and logic. 7e2c21c
* Implement Zettelkasten-style related block roaming using a BFS algorithm with depth limiting, exponential weight decay, and backlink capping. c138e54
* Introduce a new plugin to render blocks as mind maps, adding `markmap-common` and `markmap-view` dependencies. 91b5c2e
* introduce card priority for SRS and implement priority-based review sorting. 729c541
* Randomly sample hub backlinks when exceeding capacity and filter out backlinks lacking content or children. 06de84b
* Refactor `DataImporter` to centralize block creation, property formatting, and tag schema synchronization, including multi-select option merging, and utilize it for injecting missing card properties. 9a65342
* register plain block type converter for Mindmap plugin 8ca1c65
* Remove in-memory due date filtering for SRS cards, add `status` and `remark` to SRS properties, and adjust remaining card count in the review panel. 05e76cc
* Resolve mirror block IDs to their original IDs before applying tags. 62386e5

## [1.13.3](/compare/v1.13.2...v1.13.3) (2026-03-15)


### Bug Fixes

* Add key prop to Block component within TopicRenderer for proper list rendering. ef990e7


### Features

* Add `typeArgs.subType` "datetime" to the "due" tag schema. 2c03f16
* Synchronize in-memory card state with updated properties and correct `handleUpgrade` function invocation. 4cd3836

## [1.13.2](/compare/v1.13.1...v1.13.2) (2026-03-15)


### Features

* Allow dynamic refreshing of review cards in roaming mode by passing query descriptors and re-executing queries with new random seeds. 73659ef
* random schedule 0bdb066
* Register a plain text block converter for SRS review sessions. 04f11f8

## [1.13.1](/compare/v1.13.0...v1.13.1) (2026-03-15)


### Features

* automatically create the #Card tag block and its alias if it does not exist. 209e543, closes #Card
* Enhance review session layout by adjusting card height, making footer sticky, hiding editor elements, and improving button visibility. 434ab54
* Implement random sorting and a random seed for queries, defaulting to view options sort if available. 3774f56
* Refactor card tag schema initialization into modular functions and add UI for custom tag creation. 9ca7f92
* Refine card type classification, update CSS selectors for editor element visibility, and simplify review panel rendering. 2ac40a2

# [1.13.0](/compare/v1.12.11...v1.13.0) (2026-03-14)


### Bug Fixes

* prevent hiding `.orca-repr-scope-line` in SRS review sessions. c8541a6


### Features

* Add 'Skip' card functionality to the review panel with 'S' keybind and UI buttons; refactor style utility default options from null to undefined. 66bbbe6
* add orca-random-walk submodule. 0e8224e
* Add orca-srs-plugin and update orca-plugin-template submodules to vendor paths. 85693a6
* Add refresh button to the review panel header and disable content editing for the remaining card count. 118d4db
* Add Skip button to the review card's answer-shown state, disabled when saving. 162d439
* Add smart roaming for single selected blocks, including query results or related blocks (references/backlinks). eb8204b
* hide editor non-editable, go-btns, and sidetools during SRS review sessions. 5312a51
* Implement card status and remark properties, adding functions for postponing, status toggling, remark saving, and filtering suspended/archived cards. 523efdf
* Implement Spaced Repetition System (SRS) plugin with FSRS algorithm, card schema, and a dedicated review panel. 41feccf
* Implement SRS card review UI including grading, progress saving, and keyboard shortcuts. 707ec28
* Implement undo functionality for card reviews by storing and reverting card properties. ac89b1b
* Improve automatic block type detection and persistence, and update fsrsData storage type. 4c57c1d
* Internationalize SRS module strings and add a dedicated translation file. 47a9664
* Introduce keyboard shortcuts, predicted interval display, and UI refinements to the SRS review panel, updating FSRS data persistence. d960d62
* introduce Spaced Repetition System (SRS) plugin with card querying, FSRS logic, and a review panel UI. c73aa6a
* Introduce virtual cards and a "Roam in SRS" block menu command to convert blocks into reviewable SRS cards. a23b1e9

## [1.12.11](/compare/v1.12.10...v1.12.11) (2026-03-14)


### Features

* Allow configuring a custom source URL for the plugin bazaar. 04447c6

## [1.12.10](/compare/v1.12.9...v1.12.10) (2026-03-13)

## [1.12.9](/compare/v1.12.8...v1.12.9) (2026-03-13)

## [1.12.8](/compare/v1.12.7...v1.12.8) (2026-03-13)


### Features

* Implement pinyin-based slug generation for articles using `pinyin-pro`, falling back to timestamps. aeac5d7

## [1.7.9](/compare/v1.7.8...v1.7.9) (2026-01-26)

## [1.7.8](/compare/v1.7.7...v1.7.8) (2026-01-26)


### Features

* Prevent deletion of non-text empty blocks by checking block representation and refining `getRepr` utility. 1656d04

## [1.7.7](/compare/v1.7.6...v1.7.7) (2026-01-26)


### Bug Fixes

* correct typo 'hwqeay' to 'hqweay' in package name and gitignore. 297eac1

## [1.7.6](/compare/v1.7.5...v1.7.6) (2026-01-26)

## [1.7.5](/compare/v1.7.4...v1.7.5) (2026-01-26)

## [1.7.4](/compare/v1.7.3...v1.7.4) (2026-01-26)

## [1.7.3](/compare/v1.7.2...v1.7.3) (2026-01-26)

## [1.7.2](/compare/v1.7.1...v1.7.2) (2026-01-26)

## [1.7.1](/compare/v1.6.4...v1.7.1) (2026-01-26)


### Features

* Add JavaScript obfuscation and update build configurations. d812d1c

## [1.12.7](/compare/v1.12.6...v1.12.7) (2026-03-06)

## [1.12.6](/compare/v1.12.4...v1.12.6) (2026-02-26)


### Bug Fixes

* correct dirty data in block 27074 by transforming choice properties. 85aa91e


### Features

* Add `always_on` trigger to tag insertion rules and remove the `c` property from choice objects. a95734c

## [1.12.4](/compare/v1.12.3...v1.12.4) (2026-02-15)


### Features

* Add poetry tag setting to compact newlines in published content and update tag label description. a049350
* enhance Douban movie title parsing and remove cover and summary metadata fields across Douban rules. e9cad91
* Enhance pinyin slug generation by adding `nonZh` and `separator` options to handle numbers and non-Chinese characters more cleanly. 7430d4b
* Implement smart resume for browser modal, prioritizing explicit URLs, new clipboard content with user confirmation, or the last visited URL. 2e1e393

## [1.12.3](/compare/v1.12.2...v1.12.3) (2026-02-01)


### Features

* Enhance HTML to Markdown conversion with image support and whitespace trimming, reformat `cleanUrl` function, and add a debug log for properties. 9472c45

## [1.12.2](/compare/v1.12.1...v1.12.2) (2026-02-01)


### Features

* Add `contentScript` to metadata rules for separate content extraction and refactor the generic rule to utilize it. 76a527f
* enhance URL cleaning by stripping tracking parameters and centralize its implementation for webview injection. 4bce62f
* Standardize URL cleaning across Douban and generic rules, update generic domain to use origin, and include description in base metadata. 76af4fc

## [1.12.1](/compare/v1.12.0...v1.12.1) (2026-02-01)


### Bug Fixes

* Explicitly set webview user agent and handle attachment errors during initial load. eca7d70


### Features

* Use clipboard content as the URL if no URL is provided, before falling back to the homepage. 4f7aa8f

# [1.12.0](/compare/v1.11.1...v1.12.0) (2026-02-01)


### Features

* Add `new-window` event listener to webview to update URL upon new window navigation. f3e0d69
* Add content clipping functionality to the browser modal, enabling extraction of web page content (including Douban book summaries) to daily notes. 30e5ea0
* Configure webview with desktop user agent, persistent partition, direct `loadURL` navigation, and popup support. 4a5622d
* enhance markdown clipping to create structured metadata blocks in daily notes and refactor daily note saving logic. 83631aa
* Implement HTML to Markdown conversion for web content clipping and integrate it into generic metadata extraction. 757fe5c
* Import multi-line text as separate blocks, one per line, using `invokeGroup` for batch operations. 9862380
* inject an optional comment into the changelog after generation. ae21754
* Replace "Clip Content" and "Extract Metadata" buttons with icon buttons and tooltips in BrowserModal. ca3a172

## [1.11.1](/compare/v1.11.0...v1.11.1) (2026-02-01)


### Bug Fixes

* Initialize and update `isMobileMode` state based on `initialDocked` prop. 8aab088


### Features

* add homepage setting with dedicated UI and default browser URL integration. 02c463c
* Add image normalization with maxWidth support when copying images from webview to clipboard. a4f5e30

# [1.11.0](/compare/1.10.0...v1.11.0) (2026-01-31)


### Features

* update release body extraction to match any heading level in CHANGELOG.md a0bf93f

# [1.10.0](/compare/1.9.3...1.10.0) (2026-01-31)


### Bug Fixes

* Improve screenshot capture accuracy by explicitly sizing and positioning the temporary image and ensuring a single capture container. c347da3
* Synchronize `isDocked` state with `initialDocked` prop to prevent flickering. 02189f5


### Features

* Add an overlay to dismiss the browser modal's context menu when clicking outside. d244bcd
* Add VoiceNotes and ChatGPT browser links, improve webview reload error handling, and update `@types/node` dev dependency. 7ccc313
* Allow copying images from the browser modal to the clipboard and enable Pixiv in default rules. 650d975
* Centralize plugin default settings management and add restore functionality 3b0cc6b
* disable "Save Image Link" menu option in BrowserModal. 902f410
* Enhance browser modal with dynamic site-specific session management and temporarily disable image downloads. 4b6a0c9
* Implement a docked mode for the browser modal and add a sidetool to open it in this mode. 327f66a
* Implement back and forward navigation for the webview in BrowserModal, along with new translation keys. 1fec5a5
* Implement mobile user agent toggle in the browser modal and update Douban rules to match mobile URLs. fa0b3ca
* Implement saving images from the browser modal context menu to the daily note, including options to download/upload or link the image. 932804e

## [1.9.3](/compare/v1.9.2...1.9.3) (2026-01-31)


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

# [1.8.0](/compare/v1.7.9...v1.8.0) (2026-01-27)


### Features

* Add `pinyin-pro` dependency and configure `esbuild` for build optimization; fix: Correct project name typos and update package version. 16d477c
* Enhance slug generation with pinyin conversion, refine empty block deletion, and update dependencies and build configurations. c3452db

## [1.7.9](/compare/v1.7.8...v1.7.9) (2026-01-26)

## [1.7.8](/compare/v1.7.7...v1.7.8) (2026-01-26)


### Features

* Prevent deletion of non-text empty blocks by checking block representation and refining `getRepr` utility. 1656d04

## [1.7.7](/compare/v1.7.6...v1.7.7) (2026-01-26)


### Bug Fixes

* correct typo 'hwqeay' to 'hqweay' in package name and gitignore. 297eac1

## [1.7.6](/compare/v1.7.5...v1.7.6) (2026-01-26)

## [1.7.5](/compare/v1.7.4...v1.7.5) (2026-01-26)

## [1.7.4](/compare/v1.7.3...v1.7.4) (2026-01-26)

## [1.7.3](/compare/v1.7.2...v1.7.3) (2026-01-26)

## [1.7.2](/compare/v1.7.1...v1.7.2) (2026-01-26)

## [1.7.1](/compare/v1.6.4...v1.7.1) (2026-01-26)


### Features

* Add JavaScript obfuscation and update build configurations. d812d1c

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
