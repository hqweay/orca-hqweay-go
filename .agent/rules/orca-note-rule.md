---
trigger: model_decision
description: 该 rule 指定了如何理解并开发该项目，每次进行开发时都需要首先阅读该 rule。
---

这是一个 Orca Note 的插件项目，采用 Mono-repo 风格的子插件架构。

## 0. 参考文档 (Documentation)
*   **在线文档**: [Orca Note Plugin API Documentation](https://www.orca-studio.com/orcanote-docs/index.html)
*   **本地 API 类型**: `src/orca.d.ts` 是项目内最核心的 API 定义文件，包含详细的代码注释。开发时请优先查阅此文件以获取最新的类型定义和接口说明。
*   **示例插件文档**: `orca-plugin-template/plugin-docs` 包含了详细的接口说明和示例，也是重要的参考来源。
*   **开发原则**: 遇到 API 使用问题时，先查阅 `orca.d.ts`，再参考在线文档。如有类型定义缺失（如之前的 Button/Input 属性缺失），应在本地修正 `orca.d.ts` 并记录到 Docs 中。

## 1. 核心架构与依赖 (Architecture & Dependencies)
*   `src/`: 源码根目录。
*   `src/main.tsx`: 主入口，负责扫描 `src/lets-*` 目录并注册所有子插件。
*   `src/lets-*`: 子插件目录，每个文件夹代表一个独立的子插件（如 `lets-bazaar`, `lets-format`）。
*   `src/libs/`: 公共库，核心基类 `BasePlugin.ts` 位于此处。
*   **运行环境**: 插件运行在 Electron 渲染进程中，集成 Node.js 能力。
*   **框架约束**: 必须使用 **React 18** 和 **TypeScript**。
*   **依赖管理**: `react` 和 `valtio` **必须** 声明为 `peerDependencies`，严禁放入 `dependencies`，否则会导致 "Dual React Instance" 错误。
*   **状态管理**: 全局状态通过 `orca.state` (Valtio Proxy) 访问。
    - 在 React 组件中 **必须** 使用 `useSnapshot(orca.state)` 读取数据以实现响应式更新。
    - 在逻辑/命令中直接读取 `orca.state`，不要修改它，修改数据必须通过 `invokeEditorCommand` 等命令。

## 2. 子插件开发规范 & 生命周期
所有子插件必须位于 `src/lets-*` 目录下，并拥有 `index.tsx` 作为入口。

### 2.1 继承 BasePlugin
子插件类必须继承自 `BasePlugin`：
```typescript
import { BasePlugin } from "@/libs/BasePlugin";
export default class MyPlugin extends BasePlugin {
  // ...
}
```

### 2.2 生命周期 (Lifecycle)
*   **load()**: 插件启用时调用。在此处注册事件、Headbar 按钮、命令等。
*   **unload()**: 插件禁用时调用。**必须**清理所有副作用，否则重载插件会报错：
    - 注销命令 (`orca.commands.unregisterCommand`)
    - 注销渲染器 (`orca.renderers.unregisterBlock`)
    - 移除 UI (`orca.toolbar.unregisterToolbarButton`)
    - 清除定时器和 DOM 事件监听。

### 2.3 配置管理 (Settings)
我们采用 React 组件化的配置面板：
1.  **定义配置组件**: 在子插件目录下创建配置组件（如 `MySettings.tsx`）。
2.  **实现 `renderSettings`**: 在插件类中返回配置组件。
    ```typescript
    renderSettings() {
      return <MySettings plugin={this} />;
    }
    ```
3.  **读写配置**:
    *   读取: `this.getSettings()` (在类中) 或 `plugin.getSettings()` (在组件中)。
    *   写入: `this.updateSettings({ key: value })`。该方法会自动处理防抖 (Debounce) 和持久化。
    *   **设置 SCHEMA**: 优先使用 `orca.plugins.setSettingsSchema` (或是框架封装的 checkSchema) 来辅助生成设置 UI。
4.  **实时响应**: 覆盖 `onConfigChanged(newConfig)` 钩子，以便在配置变更时实时更新插件行为（无需重载）。

### 2.4 Headbar 与菜单
*   **Headbar 按钮**: 如果插件需要在顶部栏显示按钮，请提供配置项 `headbarMode` ('standalone' | 'actions' | 'both')，并根据设置在 `load` 和 `onConfigChanged` 中调用 `registerHeadbar`。
*   **Actions Menu**: 覆盖 `getHeadbarMenuItems()` 方法，返回要插入全局“动作”菜单的列表项 (`MenuText`, `MenuSeparator` 等)。

### 2.5 国际化 (i18n)
*   所有用户可见字符串必须使用 `src/libs/l10n` 提供的 `t()` 函数包裹。
*   在 `src/translations/zhCN.ts` 中添加对应的中文翻译。

## 3. 自定义块开发 (Custom Blocks) - "双生子原则"
*   **渲染器与转换器必须成对出现**: 如果注册了 `registerBlock` (渲染器)，**必须** 注册 `registerBlock` (转换器)。缺少转换器会导致搜索、导出、复制操作报错。
*   **渲染组件规范**:
    - 自定义块必须被包裹在 `<BlockShell>` 组件中。
    - 如果块包含子块，必须渲染 `<BlockChildren>`。
    - **防递归**: 禁止在自定义渲染器中直接渲染自身组件，这会导致无限递归崩溃。

## 4. 数据操作 (Data Manipulation)
*   **Block 内容**: `content` 字段不是字符串，而是 `ContentFragment[]` (对象数组)。
    - 错误: `block.content = "text"`
    - 正确: `block.content = [{ t: 't', v: 'text' }]`
*   **数据修改**: 修改 Block 结构（插入、删除、移动）必须调用编辑器核心命令，如 `core.editor.insertBlock`，以确保事务性和 Undo/Redo 支持。

## 5. UI 与命名规范
*   **命名空间**: 所有 ID（命令、设置、渲染器）必须加插件名前缀 (如 `myplugin.insertDate`)，严禁使用 `_` 开头。
*   **样式**: 禁止硬编码颜色。必须使用 CSS 变量 (如 `--orca-color-bg-1`, `--orca-color-primary-5`) 以适配深色模式。

## 7. API 避坑指南 (API Pitfalls)
该项目在开发过程中积累了以下针对 Orca Editor API 的重要经验：

### 7.1 块操作 (Block Movement)
*   **必须使用复数 API**: 使用 `core.editor.moveBlocks`，而不是 `moveBlock`。
*   **参数规范**: 即使只移动一个块，也必须传入 ID 数组：
    ```typescript
    invokeEditorCommand("core.editor.moveBlocks", null, [blockId], refBlockId, "after")
    ```

### 7.2 任务块识别 (Task Blocks)
*   任务状态存储在 `_repr` 属性中：
    ```typescript
    const reprProp = block.properties.find(p => p.name === "_repr");
    const isTask = reprProp?.value?.type === "task";
    const isCompleted = reprProp?.value?.state === 1; // 1 为完成
    ```

### 7.3 标签与属性更新
*   `core.editor.insertTag` 不会自动更新已存在的引用数据。如需更新，请使用 `core.editor.setRefData`。

### 7.4 链接属性
*   使用 `PropType.Text` 并配合 `typeArgs: { subType: "link" }` 来创建可点击的 URL。

### 7.5 Valtio Proxy 问题
*   在将数据传递给后端或进行某些底层操作前，**必须** 剥离 Valtio 代理对象以避免不可预知的错误：
    ```typescript
    const pureData = JSON.parse(JSON.stringify(proxyObject));
    ```

### 7.6 安全性与性能
*   **文件选择器**: `window.showDirectoryPicker()` 必须在用户手势回调中立即同步调用，不能放在异步操作后。
*   **GitHub API 缓存**: 获取数据时建议添加 `?t=${Date.now()}` 或设置 `cache: "no-store"` 以规避过时的 404/数据缓存。

## 8. 编译环境
*   **Mac/Unix**: 使用 `rm -rf dist`。构建脚本应保持跨平台兼容性或适配当前系统环境。

最后：如无必要，勿增实体。使用中文回复。