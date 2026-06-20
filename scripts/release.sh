#!/bin/bash
set -e

# 恐龙工具箱发版工具
# 配置：git remote 名称
GIT_REMOTE="private"

show_menu() {
    echo ""
    echo "🦕 恐龙工具箱发版工具"
    echo "========================"
    echo ""
    echo "  1) 添加变更 (changeset)"
    echo "  2) 预览变更"
    echo "  3) 发布版本"
    echo "  4) 退出"
    echo ""
}

preview_changes() {
    echo ""
    echo "📋 待发布变更:"
    echo "------------------------"
    
    CHANGESET_COUNT=0
    for file in .changeset/*.md; do
        [ "$file" = ".changeset/README.md" ] && continue
        [ ! -f "$file" ] && continue
        
        CHANGESET_COUNT=$((CHANGESET_COUNT + 1))
        
        # 解析 changeset 文件
        # 格式: ---\n"package": type\n---\n\n描述
        TYPE=$(grep -oE '(patch|minor|major)' "$file" | head -1)
        # 获取第二个 --- 之后的内容，去除空行
        DESCRIPTION=$(awk 'BEGIN{c=0} /^---$/{c++; next} c>=2 && NF{print}' "$file")
        
        echo "• [$TYPE] $DESCRIPTION"
    done
    
    if [ $CHANGESET_COUNT -eq 0 ]; then
        echo "没有待发布的变更"
        echo "请先运行 '添加变更' 创建 changeset"
        return 0
    fi
    
    echo "------------------------"
    echo "共 $CHANGESET_COUNT 个变更"
    
    # 预览版本号
    CURRENT_VERSION=$(jq -r '.version' package.json)
    echo ""
    echo "📦 当前版本: $CURRENT_VERSION"
    echo "📦 下个版本: (运行 changeset version 后自动计算)"
    
    return 0
}

do_release() {
    # 检查是否有 changeset
    CHANGESET_COUNT=0
    for file in .changeset/*.md; do
        [ "$file" = ".changeset/README.md" ] && continue
        [ ! -f "$file" ] && continue
        CHANGESET_COUNT=$((CHANGESET_COUNT + 1))
    done
    
    if [ $CHANGESET_COUNT -eq 0 ]; then
        echo "❌ 没有待发布的变更"
        echo "请先运行 '添加变更' 创建 changeset"
        return 1
    fi
    
    # 预览
    preview_changes
    
    echo ""
    read -p "确认发版？[y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "已取消"
        return 0
    fi
    
    # 执行发版
    echo ""
    echo "🚀 开始发版..."
    
    # 1. changeset version (自动更新 package.json + CHANGELOG.md)
    pnpm changeset version
    
    # 2. 获取新版本号
    NEW_VERSION=$(jq -r '.version' package.json)
    echo ""
    echo "📦 版本号: v$NEW_VERSION"
    
    # 3. 提交
    git add .
    git commit -m "release: v$NEW_VERSION"
    
    # 4. 打 tag 并推送
    git tag "v$NEW_VERSION"
    git push "$GIT_REMOTE" main --tags
    
    echo ""
    echo "✅ 已发布 v$NEW_VERSION"
    echo "🔗 https://github.com/hqweay/orca-hqweay-go/releases/tag/v$NEW_VERSION"
}

# 主循环
while true; do
    show_menu
    read -p "请选择 [1-4]: " choice
    
    case $choice in
        1)
            pnpm changeset
            ;;
        2)
            preview_changes
            ;;
        3)
            do_release
            ;;
        4)
            echo "👋 再见!"
            exit 0
            ;;
        *)
            echo "❌ 无效选择"
            ;;
    esac
done
