---
"orca-hqweay-go": minor
---

- 🔗 **收集引用 (Gather Refs)**: 新增收集反向引用子插件
  - 支持通过斜杠命令 `/gather` 触发
  - 自动聚合引用了当前聚焦块的所有顶级节点（Page/Card），并去重
  - 使用纯文本 Markdown 语法 `[Title](orca-note://...)` 批量插入引用，避免反向链接面板污染
  - 自动在光标位置生成整洁美观的 MOC 目录树
