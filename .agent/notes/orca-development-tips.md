# Orca 插件开发避坑指南 (2026-05-05)

本文记录了在开发 Orca Notes 插件过程中的关键经验、API 限制以及解决方案。

## 1. 属性插入的“隐形规则” (`TextChoices`)

*   **问题描述**：为块插入多选属性（`PropType.TextChoices`）时，仅传递 `value` 数组会导致后端无法识别或丢弃该值。
*   **解决方案**：必须在 `typeArgs` 中显式定义 `choices`。
*   **示例代码**：
    ```typescript
    {
      name: "Tags",
      type: PropType.TextChoices,
      value: ["Urgent"],
      typeArgs: {
        choices: ["Urgent", "Later"], // 必须包含当前赋值的所有选项
        subType: "multi"
      }
    }
    ```

## 2. 编辑器命令参数顺序 (`insertBlock`)

*   **问题描述**：`core.editor.insertBlock` 的参数顺序是固定的，且没有复数形式的 `insertBlocks`。
*   **参数结构**：
    1.  `cursor`: 传 `null` 表示不基于光标。
    2.  `refBlock`: 参照块对象（通常是父块或兄弟块）。
    3.  `position`: 插入位置（如 `"lastChild"`, `"firstChild"`, `"before"`, `"after"`）。
    4.  `content`: 内容片段数组 `ContentFragment[]`。
    5.  `repr`: 块表现形式对象（如 `{ type: "text" }`）。
*   **注意**：`content` 必须是扁平的片段数组 `[{t: "r", v: id}]`，不能嵌套在 `{content: [...]}` 中。

## 3. 批量引用插入：`batchInsertText`

*   **问题描述**：循环调用 `insertBlock` 插入大量引用块时效率较低。
*   **解决方案**：使用 `core.editor.batchInsertText`（如果可用）。
*   **技巧**：直接拼接 Markdown 样式的引用字符串 `[[id1]]\n[[id2]]`，作为文本一次性插入。这会自动被解析为多个引用块。

## 4. 交互式通知方案

*   **场景**：执行完某个操作（如移动）后，需要用户决定是否执行后续清理动作（如删除原块）。
*   **经验**：利用 `orca.notify` 的 `action` 回调，在通知中提供一个操作按钮，比弹窗（Confirm）更加优雅且不打断心流。

## 5. 生产环境的混淆影响

*   **现象**：
    *   生产环境 Bundle 体积显著大于开发环境。
    *   构建产物的 Hash 随构建次数随机变化。
    *   浏览器控制台可能出现 Sourcemap 解析错误。
*   **原因**：启用了 `orcaObfuscator` 混淆插件，其开启了 `deadCodeInjection`（死代码注入）和 `controlFlowFlattening`（控制流打乱）。这是正常现象。

## 6. 代码组织策略

*   **原则**：及时拆分。
*   **推荐结构**：
    *   `index.tsx`: 入口与命令注册。
    *   `logic.ts`: 纯业务逻辑（数据处理、API 调用）。
    *   `settings.tsx`: 配置 UI 组件。
    *   `types.ts`: 共享类型定义。
