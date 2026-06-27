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

## 4. 状态管理与异步交互规范 (Valtio & React)
*   **状态隔离原则 (Encapsulated State Hook)**:
    禁止 UI 组件直接写入或修改 Valtio Proxy 状态。插件的所有全局或共享状态必须在 `state.ts`/`logic.ts` 中通过自定义 Hook (例如 `useFootprintSession`) 封装，UI 仅读取导出的只读 Snapshot 字段并调用封装好的 Action 命令。
*   **Ref 缓存防闭包过期 (Mutable Ref Pattern)**:
    在含有 `await` 后端调用的异步事件处理器（如 `handleNodeRightClick`）中，**禁止直接读取** React State 或 Valtio Snapshot 快照字段。必须在渲染期间通过 `useRef` 同步最新状态/配置，并在异步逻辑中通过 `xxxRef.current` 实时获取，以保证在 Promise 决议后状态始终最新：
    ```typescript
    const latestFiltersRef = useRef(session.filters);
    latestFiltersRef.current = session.filters; // 每轮渲染同步最新值
    ```
*   **稳定回调缓存优化**:
    若 Custom Hook 在每次渲染时都返回全新的对象字面量，应使用 `sessionRef` 缓存整个 Hook 实例，并确保 `useCallback` 的依赖数组中仅保留静态依赖项（如 `[t]` 或空 `[]`），从而彻底避免回调函数的频繁重建。
*   **焦点切换缓存保护**:
    当用户聚焦图谱或侧边栏面板时，`activePanel` 切换会导致编辑器块焦点 `getFocusedBlock` 返回 `null`。必须在组件中维护一个 `frozenBlockId` 并通过 `useEffect` 仅在 `isRecording && activeBlockId !== null` 时更新，以在焦点漂移时仍能缓存并锁定最后的活动 Block 状态。
