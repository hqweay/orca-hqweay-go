---
trigger: always_on
---

# Orca API 约束与开发惯例

在开发插件的特定 API 交互时，必须严格遵守以下惯例：

## 1. 编辑器 API 限制与规范
*   **`core.editor.insertBlock` 参数顺序严格**:
    此 API 参数是固定的，且没有复数形式的 `insertBlocks`。必须按如下顺序传递：
    1.  `cursor`: 传 `null` 表示不基于光标。
    2.  `refBlock`: 参照块对象（通常是父块或兄弟块）。
    3.  `position`: 插入位置（如 `"lastChild"`, `"firstChild"`, `"before"`, `"after"`）。
    4.  `content`: 内容片段数组 `ContentFragment[]`。
    5.  `repr`: 块表现形式对象（如 `{ type: "text" }`）。
    *   **红线**: `content` 必须是扁平的片段数组，绝不能嵌套在 `{content: [...]}` 对象中。
*   **批量插入引用优化**: 
    当需要插入大量引用块时，不要循环调用 `insertBlock`。应拼接 Markdown 样式的引用字符串 `[[id1]]\n[[id2]]`，然后调用 `core.editor.batchInsertText` 自动解析，以提升性能。

## 2. 用户交互与 UX
*   **交互式通知**:
    执行完某个操作（如移动）后如果需要用户确认后续清理动作，**必须**使用 `orca.notify` 的 `action` 回调提供一个操作按钮。禁止使用阻塞式的弹窗（Confirm）打断心流。

## 3. 代码组织原则
*   每个独立功能的子插件目录应严格遵循拆分原则：
    *   `index.tsx`: 仅包含入口与命令注册。
    *   `logic.ts`: 纯业务逻辑（数据处理、API 调用）。
    *   `settings.tsx`: 配置 UI 组件。
    *   `types.ts`: 共享类型定义。
