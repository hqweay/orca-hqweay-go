---
"orca-hqweay-go": patch
---

- 修复 `lets-block-nav` 侧边栏拖拽块到兄弟节点时报错 `No command named core.editor.moveBlock` 的问题，已替换为正确的底层命令 `core.editor.moveBlocks` 并适配了参数格式。
