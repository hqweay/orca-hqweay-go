---
"orca-hqweay-go": patch
---

- 修复了 `lets-block-nav` 在开启多个编辑器窗口时打开位置不对的问题：将打开的目标节点由当前的 `activePanel` 修正为整个布局树的 `rootPanel`，确保侧边栏永远只会出现在屏幕的最左侧。
