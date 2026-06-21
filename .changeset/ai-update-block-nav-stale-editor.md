---
"orca-hqweay-go": patch
---

- 修复了打开多个编辑器面板时，`lets-block-nav` 侧边栏大纲可能展示了上一个失去焦点的编辑器内容的问题（修复了 React useEffect 执行顺序导致的状态滞后）。
