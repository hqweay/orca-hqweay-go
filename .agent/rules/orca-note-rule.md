---
trigger: model_decision
description: 该 rule 指定了如何理解并开发该项目，每次进行开发时都需要首先阅读该 rule。
---

这是一个 Orca Note 的插件项目，采用 Mono-repo 风格的子插件架构。

## 0. 参考文档 & 上下文 (Documentation & Context)
*   **上下文名词解释**: 请阅读项目根目录的 `CONTEXT.md`，使用里面定义的术语（如 Block, Task Block, ContentFragment 等）。
*   **架构决策**: 请查阅 `docs/adr/` 目录，了解过去设计的历史和实现思路。
*   **在线文档**: [Orca Note Plugin API Documentation](https://www.orca-studio.com/orcanote-docs/index.html)
*   **本地 API 类型**: 优先查阅 `src/orca.d.ts` 获取最新的类型定义和接口说明。遇到 API 限制时，在本地修正并记录。

## 1. 核心架构与框架约束 (Architecture & Constraints)
*   **入口**: 主入口 `src/main.tsx` 动态扫描并加载 `src/lets-*` 目录下的所有子插件。
*   **环境限制**: 必须使用 **React 18** 和 **TypeScript**。运行在 Electron 渲染进程中。
*   **依赖红线**: `react` 和 `valtio` **必须** 声明为 `peerDependencies`，严禁放入 `dependencies`，否则会导致 "Dual React Instance" 错误。
*   **全局状态红线 (`orca.state`)**:
    - 在 React 组件中 **必须** 使用 `useSnapshot(orca.state)` 读取数据以实现响应式更新。
    - 在逻辑/命令中直接读取 `orca.state` 时，**绝对禁止直接修改它**，修改数据必须通过 `invokeEditorCommand` 等命令触发。
    - **克隆陷阱 (`cloneDeep`)**:
      - **必须克隆**: 从 `orca.state` 状态树中读取的深层嵌套对象（如 `block.properties`、`viewArgs.query`、`repr.q.q` 等），在传入 `invokeEditorCommand`、`invokeBackend` 等跨通信边界的核心 API 前，必须使用 `cloneDeep(obj)` 剥离 Valtio Proxy，否则底层序列化会抛出 `Illegal invocation` / `DataCloneError`。
      - **无需克隆**: `registerEditorCommand` 回调参数中的 `_cursor`、`_panelId`、`_rootBlockId` 等由命令分发器提供的上下文参数，它们是分发器在触发时生成的快照，不是 Valtio Proxy，可直接传递。

## 2. 子插件生命周期与 UI 规范
*   **基类**: 所有子插件必须继承自 `src/libs/BasePlugin.ts`。
*   **卸载清理 (unload)**: 插件禁用时**必须**清理所有副作用（如 `unregisterCommand`, `unregisterBlock`, 清除定时器/事件监听）。
*   **自动化配置界面**: 子插件无需写完整的 Settings 面板。只需声明 `headbarButtonId`，基类会自动生成开关并支持在独立的 `SettingsBoard` 中按需通过 `renderCustomSettings()` 自绘配置，以此保证命名空间隔离。
*   **双生子原则 (Custom Blocks)**: 如果注册了 `registerBlock` (渲染器)，**必须**配套注册其转换器，否则会导致搜索、导出、复制等核心功能报错。在自定义块渲染器中，绝对禁止直接渲染自身组件导致无限递归崩溃。
*   **样式约定**: 禁止硬编码颜色。必须使用内置 CSS 变量 (如 `--orca-color-bg-1`, `--orca-color-primary-5`) 以适配深色模式。

## 3. 开发工作流与多语言 (Workflow & i18n)
*   **i18n 强制包裹**: 所有用户可见的 UI 字符串，必须使用子插件基类提供的 `this.t()` 函数包裹。禁止直接使用全局的 `t()` 以防命名空间污染。（如果是纯 UI 组件，请通过 props 将 plugin 实例传入并调用 `plugin.t()`）。
*   **翻译自动加载**: 新模块的翻译写在 `src/translations/parts/[name].ts` 中，系统会自动扫描，无需手动修改 `zhCN.ts` 聚合文件。
*   **配置项翻译基准**: 对子插件，必须在翻译中包含 `"[name]"` 和 `"[name].description"` 键。

## 4. 更新日志维护 (CHANGELOG.md)
AI 可以直接修改 `CHANGELOG.md`，但**必须遵守格式规则**：请阅读 `.agent/rules/orca-changelog-convention.md`。
新条目追加在对应版本的 `###` section 下。如果还没有对应版本号，在 `##` 下新建 `###` section。

## 5. 遗留代码迁移原则 (Legacy Migration & Boy Scout Rule)
当你在任何旧插件中工作时，请顺手应用最新的最佳实践（童子军军规）：
1. **翻译 API 迁移**：将所有的全局 `t("...")` 替换为 `this.t("...")`。
2. **事件与命令卸载机制**：如果旧代码在 `load()` 中使用闭包数组 `_cleanupFns` 来 push 清理方法，请尽量重构：
   - 绝大部分可以通过直接把方法转为普通函数然后放到 `unload()` 中去执行。
   - 命令和区块菜单清理请统一由 BasePlugin 提供的 `_registeredCommandIds` 机制自动完成。
3. **搜索引擎解耦**：绝不允许在 UI 组件（`.tsx`）中直接读取或修改全局 `searchCache`。有关节点树快照的操作，必须通过调用 `src/lets-block-nav/utils/searchEngine.ts` 中封装的安全 API 实现。

最后：如无必要，勿增实体。使用中文回复。