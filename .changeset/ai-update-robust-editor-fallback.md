---
"orca-hqweay-go": patch
---

- 为 `lets-arc-tabs` 的 Pin/Unpin 和 `lets-block-nav` 的拖拽排序加入了更健壮的编辑器焦点回退策略：优先使用静默的“焦点闪回法”，若极端情况下不存在任何激活的编辑器，则回退到 `orca.nav.goTo` 强制拉起编辑器执行命令，保证核心功能始终可用。
