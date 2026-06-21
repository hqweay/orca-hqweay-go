---
"orca-hqweay-go": patch
---

- 彻底修复了侧边栏搜索时触发的 React Error 300 崩溃问题。确保提前阻断渲染的 `return null` 位于所有的拖拽 Hook（`useCallback`）之后。
