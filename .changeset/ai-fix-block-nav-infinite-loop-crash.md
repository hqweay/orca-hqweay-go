---
"orca-hqweay-go": patch
---

- 彻底修复了由于笔记图谱中出现循环引用或自引用（`block.parent === block.id`）引发的无限循环死机（崩溃）问题。为 `handleSearch` 和 `resolveAndLoad` 中的层级回溯增加了环路检测和防重入机制，保障侧边栏在极端数据下的绝对稳定性。
