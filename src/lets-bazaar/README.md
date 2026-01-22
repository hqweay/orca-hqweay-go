# Orca Bazaar (`lets-bazaar`)

The **Orca Bazaar** is a plugin marketplace for Orca Notes, allowing users to discover and install community plugins with ease.

## Features

- **Browsing**: View a list of curated plugins from the community.
- **One-Click Install**: Installs plugins directly from GitHub Releases.
    - Handles downloading, unzipping, and placing files in the correct `dist` structure.
- **Updates**: Detects installed plugins (basic version).
- **Caching**: Caches the plugin list locally for instant loading.
- **Offline Capable**: Works even if GitHub is temporarily unreachable (if cached).

## Usage

1.  Open **Command Palette** (`Cmd+P`) -> `Open Bazaar`.
2.  Or click the **Shopping Bag** icon in the headbar.
3.  Browse the list and click **Install**.
4.  Reload Orca (`Cmd+R`) to activate the new plugin.

## Contributing a Plugin

To submit your plugin to the Bazaar:

1.  Host your plugin on GitHub.
2.  Ensure your Release contains a `.zip` asset (e.g., `dist.zip` or `repo-name.zip`).
3.  Submit a PR to the [Orca Bazaar Repository](https://github.com/hqweay/orca-bazaar).
4.  Add your repo to `plugins.json`.

For more details, visit the [Contribution Repository](https://github.com/hqweay/orca-bazaar).
