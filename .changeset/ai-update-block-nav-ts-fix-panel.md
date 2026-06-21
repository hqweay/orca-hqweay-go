---
"orca-hqweay-go": patch
---

- 修复了在检查面板是否存在时由于 TypeScript 接口定义不匹配引发的类型报错：使用 `isEditorPanel` 递归查询面板树，替代错误的直接字典索引。
