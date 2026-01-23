#!/bin/bash

# Usage Examples:
#
# 1. Simple commit and push (no version update):
#    ./update-version.sh a "fix: meaningful commit message"
#
# 2. release version (Update package.json, tag, and push):
#    ./update-version.sh 1.0.1 "feat: release description"

# Exit on error
set -e

# Function to display usage
usage() {
    echo "Usage:"
    echo "  $0 a <comment>              # Simple commit and push"
    echo "  $0 <version> <comment>      # Update version, tag, and release"
    exit 1
}

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "Error: jq is not installed."
    exit 1
fi

# Ensure at least one argument is provided
if [ -z "$1" ]; then
    usage
fi

TYPE="$1"
COMMENT="$2"

if [ "$TYPE" = "a" ]; then
    if [ -z "$COMMENT" ]; then
        echo "Error: Comment is required for 'a' command."
        exit 1
    fi
    echo "Performing simple commit..."
    echo "Comment: $COMMENT"
    
    git add .
    git commit -m "$COMMENT"
    git push
else
    NEW_VERSION="$TYPE"
    if [ -z "$COMMENT" ]; then
        # Handle case where comment might be optional or default
        COMMENT="Update to $NEW_VERSION"
    fi
    
    echo "Releasing version: $NEW_VERSION"
    echo "Comment: $COMMENT"

    # Safely update package.json using a temp file
    TMP_FILE=$(mktemp)
    jq --arg new_version "$NEW_VERSION" '.version = $new_version' package.json > "$TMP_FILE"
    mv "$TMP_FILE" package.json

    git add .
    git commit -m "release: $NEW_VERSION $COMMENT"
    git push
    
    git tag "$NEW_VERSION"
    # Keeping the original logic of pushing to 'my' remote for tags
    git push my "$NEW_VERSION" || echo "Warning: Failed to push tag to 'my' remote. Trying origin..." && git push origin "$NEW_VERSION"
fi

echo "Done."