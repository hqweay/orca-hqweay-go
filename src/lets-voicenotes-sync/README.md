# VoiceNotes Sync Plugin

A powerful plugin for two-way synchronization between Orca Notes and [VoiceNotes.com](https://voicenotes.com).

## Features

- **Inbound Sync (VoiceNotes -> Orca)**:
  - Fetches your latest recordings.
  - Automatically organizes notes into your **Daily Journal** based on your local time.
  - Supports **Subnotes**: Recursively syncs and links subnotes as children blocks.
  - Supports **Related Notes**: Identifies and links related notes if they are already synced.
  - Handles **Attachments**: Downloads images and syncs them as Orca assets.
  - **Duplicate Detection**: Uses a dedicated tag (e.g., `#VoiceNote`) with an `ID` property to prevent duplication.

- **Outbound Sync (Orca -> VoiceNotes)**:
  - Context menu action: **"Sync to VoiceNotes"**.
  - Creates new VoiceNotes from your blocks.
  - Updates existing VoiceNotes (transcript and tags).

## Configuration

1.  **API Key**: Enter your VoiceNotes API Key in the plugin settings.
2.  **Tag**: Configure the tag to identify synced notes (default: `#VoiceNote`).
3.  **Exclude Tags**: Optional, comma-separated list of tags to exclude from sync.

## Usage

- **Syncing**: Click the plugin icon in the sidebar to fetch latest notes.
- **Pushing**: Right-click any block and select "Sync to VoiceNotes" to push it to the server.
