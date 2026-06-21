#!/bin/bash
set -e

# 恐龙工具箱发版工具
# 配置：git remote 名称
GIT_REMOTE="private"

# 统计 changeset 数量
count_changesets() {
    local count=0
    for file in .changeset/*.md; do
        [ "$file" = ".changeset/README.md" ] && continue
        [ ! -f "$file" ] && continue
        count=$((count + 1))
    done
    echo $count
}

# 显示菜单
show_menu() {
    echo ""
    echo "🦕 恐龙工具箱发版工具"
    echo "========================"
    echo ""
    echo "  1) 添加变更"
    echo "  2) 预览变更"
    echo "  3) 发布版本"
    echo "  4) 更新市集"
    echo "  5) 发布并更新市集 (一键)"
    echo "  6) 退出"
    echo ""
}

# 智能添加变更
smart_add_changeset() {
    CHANGESET_COUNT=$(count_changesets)
    
    if [ $CHANGESET_COUNT -gt 0 ]; then
        # 有 changeset，显示并询问
        echo ""
        echo "📋 已有 $CHANGESET_COUNT 个 changeset:"
        preview_changes
        echo ""
        echo "  1) 继续添加"
        echo "  2) 预览"
        echo "  3) 返回"
        echo ""
        read -p "请选择 [1-3]: " sub_choice
        case $sub_choice in
            1) pnpm changeset ;;
            2) preview_changes ;;
            *) return 0 ;;
        esac
    else
        # 无 changeset，询问生成方式
        echo ""
        echo "📋 没有 changeset 文件"
        echo ""
        echo "  1) 手动添加 (changeset)"
        echo "  2) 从 commit 生成"
        echo "  3) 返回"
        echo ""
        read -p "请选择 [1-3]: " sub_choice
        case $sub_choice in
            1) pnpm changeset ;;
            2) generate_from_commits ;;
            *) return 0 ;;
        esac
    fi
}

# 从 commit 生成 changeset
generate_from_commits() {
    echo ""
    echo "📝 从 commit 生成 changeset..."
    
    # 获取上次 tag
    LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
    
    if [ -z "$LAST_TAG" ]; then
        echo "没有找到 tag，将使用所有 commit"
        COMMITS=$(git log --oneline --no-merges)
    else
        echo "上次发版: $LAST_TAG"
        COMMITS=$(git log ${LAST_TAG}..HEAD --oneline --no-merges)
    fi
    
    if [ -z "$COMMITS" ]; then
        echo "没有新的 commit"
        return 0
    fi
    
    echo ""
    echo "📋 待处理的 commit:"
    echo "$COMMITS" | head -10
    
    # 解析 commit 类型
    MINOR_COMMITS=""
    PATCH_COMMITS=""
    
    while IFS= read -r line; do
        MSG=$(echo "$line" | cut -d' ' -f2-)
        if echo "$MSG" | grep -qE "^feat(\(.+\))?!?: "; then
            DESC=$(echo "$MSG" | sed 's/^feat(\(.*\))\?!: //')
            MINOR_COMMITS="${MINOR_COMMITS}- ${DESC}\n"
        elif echo "$MSG" | grep -qE "^(fix|perf)(\(.+\))?!?: "; then
            DESC=$(echo "$MSG" | sed 's/^[a-z]*\(([^)]*)\)\?!: //')
            PATCH_COMMITS="${PATCH_COMMITS}- ${DESC}\n"
        fi
    done <<< "$COMMITS"
    
    # 确定版本类型
    if [ -n "$MINOR_COMMITS" ]; then
        BUMP_TYPE="minor"
        echo ""
        echo "📦 检测到新功能，将创建 minor 变更"
    elif [ -n "$PATCH_COMMITS" ]; then
        BUMP_TYPE="patch"
        echo ""
        echo "📦 检测到修复，将创建 patch 变更"
    else
        echo ""
        echo "⚠️ 没有检测到 feat/fix/perf 类型的 commit"
        echo "请手动添加 changeset"
        pnpm changeset
        return
    fi
    
    # 显示将生成的内容
    echo ""
    echo "将生成以下 changeset:"
    echo "------------------------"
    if [ -n "$MINOR_COMMITS" ]; then
        echo -e "$MINOR_COMMITS"
    fi
    if [ -n "$PATCH_COMMITS" ]; then
        echo -e "$PATCH_COMMITS"
    fi
    echo "------------------------"
    
    echo ""
    read -p "确认生成？[y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "已取消"
        return 0
    fi
    
    # 生成 changeset 文件
    TIMESTAMP=$(date +%s)
    CHANGESET_FILE=".changeset/auto-${TIMESTAMP}.md"
    
    # 合并所有描述
    ALL_DESCRIPTIONS=""
    if [ -n "$MINOR_COMMITS" ]; then
        ALL_DESCRIPTIONS=$(echo -e "$MINOR_COMMITS" | sed 's/^- //' | tr '\n' ';' | sed 's/;$//')
    fi
    if [ -n "$PATCH_COMMITS" ]; then
        if [ -n "$ALL_DESCRIPTIONS" ]; then
            ALL_DESCRIPTIONS="${ALL_DESCRIPTIONS};$(echo -e "$PATCH_COMMITS" | sed 's/^- //' | tr '\n' ';' | sed 's/;$//')"
        else
            ALL_DESCRIPTIONS=$(echo -e "$PATCH_COMMITS" | sed 's/^- //' | tr '\n' ';' | sed 's/;$//')
        fi
    fi
    
    # 将分号替换为逗号
    FINAL_DESCRIPTION=$(echo "$ALL_DESCRIPTIONS" | sed 's/;/, /g')
    
    cat > "$CHANGESET_FILE" << EOF
---
"orca-hqweay-go": ${BUMP_TYPE}
---

${FINAL_DESCRIPTION}
EOF
    
    echo ""
    echo "✅ 已生成: $CHANGESET_FILE"
    echo ""
    echo "内容预览:"
    cat "$CHANGESET_FILE"
}

# 预览变更
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
        TYPE=$(grep -oE '(patch|minor|major)' "$file" | head -1)
        DESCRIPTION=$(awk 'BEGIN{c=0} /^---$/{c++; next} c>=2 && NF{print}' "$file")
        
        echo "• [$TYPE] $DESCRIPTION"
    done
    
    if [ $CHANGESET_COUNT -eq 0 ]; then
        echo "没有待发布的变更"
        return 0
    fi
    
    echo "------------------------"
    echo "共 $CHANGESET_COUNT 个变更"
    
    # 预览版本号
    CURRENT_VERSION=$(jq -r '.version' package.json)
    echo ""
    echo "📦 当前版本: $CURRENT_VERSION"
    
    return 0
}

# 发布版本
do_release() {
    local WITH_REGISTRY=$1
    CHANGESET_COUNT=$(count_changesets)
    
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
    
    # 1. changeset version
    pnpm changeset version
    
    # 2. 获取新版本号
    NEW_VERSION=$(jq -r '.version' package.json)
    echo ""
    echo "📦 版本号: v$NEW_VERSION"
    
    # 3. 提交
    git add .
    if [ "$WITH_REGISTRY" = "with_registry" ]; then
        git commit -m "release: v$NEW_VERSION [update registry]"
    else
        git commit -m "release: v$NEW_VERSION"
    fi
    
    # 4. 打 tag 并推送
    git tag "v$NEW_VERSION"
    git push "$GIT_REMOTE" main --tags
    
    echo ""
    echo "✅ 已发布 v$NEW_VERSION"
    echo "🔗 https://github.com/hqweay/orca-hqweay-go/releases/tag/v$NEW_VERSION"
    
    if [ "$WITH_REGISTRY" = "with_registry" ]; then
        echo "⏳ Github Action 将在 Release 构建完成后自动为你更新市集！"
    fi
}

# 更新市集
update_registry() {
    CURRENT_VERSION=$(jq -r '.version' package.json)
    echo ""
    echo "📦 当前版本: v$CURRENT_VERSION"
    echo ""
    read -p "确认更新市集？[y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "已取消"
        return 0
    fi
    
    echo ""
    echo "🚀 正在触发市集更新..."
    
    if command -v gh &> /dev/null; then
        gh workflow run update-registry.yml -f version="$CURRENT_VERSION"
        echo "✅ 已触发市集更新 workflow"
        echo "🔗 https://github.com/hqweay/orca-hqweay-go/actions/workflows/update-registry.yml"
    else
        echo "❌ 未安装 gh CLI"
        echo "请手动触发: https://github.com/hqweay/orca-hqweay-go/actions/workflows/update-registry.yml"
    fi
}

# 发布并更新市集
do_release_and_registry() {
    do_release "with_registry"
}

# 主循环
while true; do
    show_menu
    read -p "请选择 [1-6]: " choice
    
    case $choice in
        1)
            smart_add_changeset
            ;;
        2)
            preview_changes
            ;;
        3)
            do_release
            ;;
        4)
            update_registry
            ;;
        5)
            do_release_and_registry
            ;;
        6)
            echo "👋 再见!"
            exit 0
            ;;
        *)
            echo "❌ 无效选择"
            ;;
    esac
done
