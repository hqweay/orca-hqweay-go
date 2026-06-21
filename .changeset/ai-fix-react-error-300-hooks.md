---
"orca-hqweay-go": patch
---

- 修复了侧边栏搜索时触发的 React Error 300 (Rendered fewer hooks than expected) 崩溃问题。这是由于在搜索过滤未命中节点时，过早执行了 `return null` 导致 React Hooks 渲染数量不一致所致，现已将拦截逻辑移至所有 Hooks 声明之后，严格遵守 React Hooks 规范。
