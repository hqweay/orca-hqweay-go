#!/bin/bash
set -e

echo "📦 开始构建更新包..."

# 运行构建命令
pnpm run build

echo ""
echo "✅ 构建完成！更新包已生成在项目根目录的 package.zip"
echo "你可以通过市集安装本地插件来测试这个更新包。"
