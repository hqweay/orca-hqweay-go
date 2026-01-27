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

### 2.3 配置管理 (Settings) - 自动化模式
我们采用“逻辑声明式”配置。大部分插件无需编写 UI 代码：
1.  **自动化渲染**: 只要子插件声明了 `headbarButtonId`，`BasePlugin` 会自动渲染 `PluginSettings` 组件（包含显示模式切换）。
2.  **自定义扩展**: 如果需要额外设置项，覆盖 `renderCustomSettings()` 方法：
    ```typescript
    protected renderCustomSettings() {
      return <div className="my-logic">...</div>;
    }
    ```
3.  **读写配置**:
    *   读取: `this.getSettings()`。
    *   写入: `this.updateSettings({ key: value })`。
4.  **可见性判定**: 依靠 `hasSettings()` 自动决定是否要在设置中心显示该插件（由 `headbarButtonId` 或 `renderCustomSettings` 决定）。

*   **声明式注册**: 子插件只需声明 `protected headbarButtonId = "...";`。
*   **渲染函数**: 必须实现 `renderHeadbarButton()` 返回独立按钮 UI。
*   **菜单扩展**: 覆盖 `renderHeadbarMenuItems(closeMenu)`。`BasePlugin` 会自动根据 `headbarMode` 判断是否渲染这些菜单项。子插件禁止手动检查 `headbarMode`。
*   **生命周期自动同步**: `BasePlugin` 会自动处理按钮的注册与销毁，严禁在子插件 `load` 中手动注册按钮。

### 2.5 国际化 (i18n)
*   所有用户可见字符串必须使用 `src/libs/l10n` 提供的 `t()` 函数包裹。
*   翻译文件统一存放在 `src/translations/` 下。

### 2.6 命名约定与环境隔离 (Naming & Environment)
*   **正式插件**: 目录命名为 `src/lets-[name]`。
*   **测试/示例插件**: 目录命名为 `src/lets-test-[name]`。
*   **自动隔离**: 系统会自动识别并在生产环境下跳过所有 `lets-test-*` 插件的加载，确保生产环境的纯净。


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

## 6. 开发流程与文档
1.  **复用优先**: 新功能优先考虑放入现有子插件，或提取公共方法至 `src/libs`。
2.  **查阅文档**: 开发前查看 `docs` 目录及本规则。
3.  **踩坑记录**: 遇到并解决的技术难题（如 API 限制、State 陷阱等），**必须**记录到 `walkthrough.md` 或 `docs` 下的相关文档中，以备后查。
4.  **严谨性**: 检查代码不使用不存在的 API，确保结构清晰、无明显 Bug。

最后：如无必要，勿增实体。使用中文回复。