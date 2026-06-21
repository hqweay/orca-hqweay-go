---
"orca-hqweay-go": patch
---

- 移除 `lets-block-nav` 侧边栏中无效的 "Expand All" 和 "Collapse All" 按钮及相关逻辑，由于当前采用的是仅加载一层兄弟节点的平面列表模式，树状折叠功能并不适用。
