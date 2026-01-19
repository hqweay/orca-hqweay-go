# Publish to GitHub Plugin

Easily publish your Orca Notes page blocks as Markdown articles to a GitHub repository, complete with image hosting and automatic updates.

## Features

*   **One-Click Publishing**: Publish any **Page Block** (root block) as a Jekyll/Hexo/Hugo-compatible Markdown file.
*   **Automatic Image Bed**:
    *   Detects local images in your content.
    *   Checks if the image already exists in your configured Image Bed repository (by filename).
    *   Uploads new images or reuses existing URLs (deduplication).
    *   Replaces local image links with public GitHub raw/download URLs.
*   **Smart Updates**:
    *   **Source of Truth**: Tracks posts using the `github_url` property stored on the block's "Published" tag.
    *   **No Redundancy**: Does *not* store a separate `slug` property.
    *   **Intelligent Parsing**: Derives the update path and slug directly from the GitHub URL.
*   **Metadata Management**:
    *   **Live Links**: Stores `github_url` and `blog_url` as **clickable Links**.
    *   **Date Preservation**: Stores `publish_date` to ensure the original creation date is kept even when you update the post.
    *   **Frontmatter**: Automatically generates `title`, `date`, `updated`, `tags`, etc.
*   **Configurable**:
    *   **Two Repos**: Separate configurations for **Blog Repository** (md files) and **Image Bed Repository** (images).
    *   **Custom Domain**: Set your blog's `base domain` for generating preview links.
    *   **Tag Label**: Customize the name of the tag used to mark published posts (default: "已发布").

## Usage

1.  **Configure**:
    *   Go to **Orca Settings -> Plugins -> lets-publish**.
    *   Fill in your GitHub Tokens, Repo Owner/Name/Branch for both Image Bed and Blog.
    *   Set your `Blog Domain` (e.g., `https://hqweay.cn`) to get clickable blog links.

2.  **Publish**:
    *   Right-click on any **Page Block** (a block with no parent).
    *   Select `Publish to GitHub`.

3.  **Result**:
    *   The block content is converted to Markdown.
    *   Images are uploaded/reused.
    *   The article is pushed to your Blog Repo.
    *   A "已发布" tag (or your custom label) is added/updated on the block.
    *   **Check Properties**: Expand the block properties to see the clickable `github_url` and `blog_url`.

## Settings

*   **Image Bed**: Owner, Repo, Branch, Path (e.g., `img/`), Token.
*   **Blog**: Owner, Repo, Branch, Path (e.g., `source/_posts/`), Token, **Domain**.
*   **General**:
    *   **Tag Label**: The tag text to use (default: "已发布").
    *   **Committer**: Name and Email for git commits.
