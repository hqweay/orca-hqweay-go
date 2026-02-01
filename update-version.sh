#!/bin/bash

# Usage:
#   ./update-version.sh a "commit message"       # Simple commit & push
#   ./update-version.sh patch "comment"          # 1.0.0 -> 1.0.1
#   ./update-version.sh minor "comment"          # 1.0.0 -> 1.1.0
#   ./update-version.sh major "comment"          # 1.0.0 -> 2.0.0
#   ./update-version.sh 1.2.3 "comment"          # Manual version

set -e

GIT_REMOTE="my"

usage() {
    echo "Usage:"
    echo "  $0 a <comment>              # Simple commit and push"
    echo "  $0 patch|minor|major <msg>  # Auto increment version & release"
    echo "  $0 <version> <msg>          # Manual version & release"
    exit 1
}

if ! command -v jq &> /dev/null; then
    echo "Error: jq is not installed."
    exit 1
fi

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

# 2. Release mode
CURRENT_VERSION=$(jq -r '.version' package.json)
NEW_VERSION=""

if [[ "$TYPE" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || [[ "$TYPE" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    NEW_VERSION="${TYPE#v}" # Remove 'v' if manually provided for package.json
else
    # Auto increment logic
    IFS='.' read -r major minor patch <<< "$CURRENT_VERSION"
    case "$TYPE" in
        major)
            NEW_VERSION="$((major + 1)).0.0"
            ;;
        minor)
            NEW_VERSION="$major.$((minor + 1)).0"
            ;;
        patch)
            NEW_VERSION="$major.$minor.$((patch + 1))"
            ;;
        *)
            usage
            ;;
    esac
fi

if [ -z "$COMMENT" ]; then
    COMMENT="Update to $NEW_VERSION"
fi

echo "Current version: $CURRENT_VERSION"
echo "Release version: $NEW_VERSION"
echo "Comment: $COMMENT"

# Update package.json
TMP_FILE=$(mktemp)
jq --arg nv "$NEW_VERSION" '.version = $nv' package.json > "$TMP_FILE"
mv "$TMP_FILE" package.json

# Generate Changelog
echo "Generating changelog..."
pnpm utils:changelog

# Inject Comment into Changelog (after header)
if [ -n "$COMMENT" ]; then
  # Insert comment at line 3 (after header and empty line)
  # Using a temporary file to safely editing
  awk -v comment="$COMMENT" 'NR==3{print comment; print ""} 1' CHANGELOG.md > CHANGELOG.tmp && mv CHANGELOG.tmp CHANGELOG.md
fi

# Commit and Push
git add .
git commit -m "release: $NEW_VERSION $COMMENT"
git push "$GIT_REMOTE"

# Tag and Push Tag (with 'v' prefix)
TAG_NAME="v$NEW_VERSION"
git tag "$TAG_NAME"
git push "$GIT_REMOTE" "$TAG_NAME"

echo "Done. Released $TAG_NAME"