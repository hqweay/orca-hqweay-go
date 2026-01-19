# Publish to GitHub Plugin

Easily publish your Orca Notes blocks as Markdown articles to a GitHub repository, complete with image hosting and automatic updates.

## Features

*   **One-Click Publishing**: Publish any block as a Jekyll/Hexo/Hugo-compatible Markdown file.
*   **Automatic Image Bed**:
    *   Detects local images in your content.
    *   Checks if the image already exists in your configured Image Bed repository (by filename).
    *   Uploads new images or reuses existing URLs.
    *   Replaces local image links with public GitHub raw/download URLs.
*   **Smart Updates**:
    *   Tracks published posts using a `slug` property on a "已发布" tag.
    *   Updates existing files instead of creating duplicates.
*   **Metadata Management**:
    *   Automatically generates Frontmatter (`title`, `date`, `updated`, `tags`, etc.).
    *   Stores the `slug` on the block for persistent tracking.
*   **Configurable**:
    *   Separate configurations for **Blog Repository** (where `.md` files go) and **Image Bed Repository** (where images go).
    *   Supports custom paths, branches, and commit info.
    *   **Secure**: Token trimming prevents whitespace errors.

## Usage

1.  **Configure**: Go to Orca Settings -> Plugins -> `lets-publish` and fill in your GitHub Repo details and Tokens.
2.  **Publish**:
    *   Right-click on any block.
    *   Select `Publish to GitHub`.
3.  **Result**:
    *   The block content is converted to Markdown.
    *   Images are uploaded to your Image Bed.
    *   The article is pushed to your Blog Repo.
    *   A "已发布" tag is added to the block with a `slug` property.

## Settings

*   **Image Bed**: Owner, Repo, Branch, Path (e.g., `img/`), Token.
*   **Blog**: Owner, Repo, Branch, Path (e.g., `source/_posts/`), Token.
*   **Committer**: Name and Email for git commits.
