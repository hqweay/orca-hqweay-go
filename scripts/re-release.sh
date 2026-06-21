#!/bin/bash
set -e

GIT_REMOTE="private"
CURRENT_VERSION=$(jq -r '.version' package.json)

echo "📦 准备重新发布版本 v$CURRENT_VERSION"

echo "🗑️  删除本地 tag..."
git tag -d "v$CURRENT_VERSION" || true

echo "🗑️  删除远程 tag..."
git push "$GIT_REMOTE" --delete "v$CURRENT_VERSION" || true

echo "🏷️  重新打 tag..."
git tag "v$CURRENT_VERSION"

echo "🚀 推送新 tag..."
git push "$GIT_REMOTE" "v$CURRENT_VERSION"

echo "✅ 重新发版触发完成！请前往 Github Actions 查看进度。"
