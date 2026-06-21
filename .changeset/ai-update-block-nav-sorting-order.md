---
"orca-hqweay-go": patch
---

- 修复 `lets-block-nav` 侧边栏列表顺序可能与编辑器内不一致的问题。这是因为底层 API `get-blocks` 批量返回块时并不保证顺序，现在强制按照父节点的 `children` 数组顺序对返回数据进行二次重排。
