---
"orca-hqweay-go": patch
---

- 修复了侧边栏 Filter 输入框可能导致的崩溃问题。
- 优化了侧边栏 Filter 输入框的 UI：使用了更贴合系统原生的 `CompositionInput` 组件，并将搜索框移至标题下方，以获得更干净的布局。同时 `CompositionInput` 支持中文拼音防抖，在拼音输入过程中不会频繁触发树形重新计算。
