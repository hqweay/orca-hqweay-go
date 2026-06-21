---
"orca-hqweay-go": patch
---

- 修复了侧边栏大纲中长标题被硬编码强制截断为 20 个字符的问题。现在放开了底层数据限制，将其完全交给 CSS `text-overflow: ellipsis` 动态截断，完美解决了截断后导致悬浮提示（Hover Tooltip）内容不全，以及长尾文字无法触发搜索高亮的问题。
