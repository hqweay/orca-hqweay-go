#!/bin/bash

# 轻量级版本更新脚本
# Changesets 负责 changelog 和版本号管理

set -e

# Configuration
GIT_REMOTE="private"

usage() {
    echo "Usage:"
    echo "  $0 a <comment>              # Simple commit and push"
    echo "  $0 <version> <msg>          # Manual version & release"
    exit 1
}

if [ -z "$1" ]; then
    usage
fi

TYPE="$1"
COMMENT="$2"

# 1. Simple commit mode
if [ "$TYPE" = "a" ]; then
    if [ -z "$COMMENT" ]; then
        echo "Error: Comment is required for 'a' command."
        exit 1
    fi
    git add .
    git commit -m "$COMMENT"
    git push "$GIT_REMOTE"
    echo "Done."
    exit 0
fi

# 2. Release mode - 手动指定版本号
if [[ "$TYPE" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || [[ "$TYPE" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    NEW_VERSION="${TYPE#v}"
else
    echo "Error: Please provide a version number (e.g., 2.13.0)"
    usage
fi

if [ -z "$COMMENT" ]; then
    COMMENT="Update to $NEW_VERSION"
fi

echo "Release version: $NEW_VERSION"
echo "Comment: $COMMENT"

# Update package.json
TMP_FILE=$(mktemp)
jq --arg nv "$NEW_VERSION" '.version = $nv' package.json > "$TMP_FILE"
mv "$TMP_FILE" package.json

# Commit and Push
git add .
git commit -m "release: v${NEW_VERSION} - ${COMMENT}"
git push "$GIT_REMOTE"

# Tag and Push Tag
TAG_NAME="v$NEW_VERSION"
git tag "$TAG_NAME"
git push "$GIT_REMOTE" "$TAG_NAME"

echo "Done. Released $TAG_NAME"
