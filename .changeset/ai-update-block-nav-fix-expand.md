---
"orca-hqweay-go": patch
---

- 修复了 `lets-block-nav` 展开折叠图标点击后无法立即刷新的 Bug，原因是原有的 `Set` 数据结构不受 Valtio 默认 Proxy 追踪的影响，已将其重构为受支持的 Record（字典）结构。
