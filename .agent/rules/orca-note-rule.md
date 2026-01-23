---
trigger: model_decision
description: 该 rule 指定了如何理解并开发该项目，每次进行开发时都需要首先阅读该 rule。
---

这是一个 Orca Note 的插件项目，采用 Mono-repo 风格的子插件架构。

## 1. 项目结构
*   `src/`: 源码根目录。
*   `src/main.tsx`: 主入口，负责扫描 `src/lets-*` 目录并注册所有子插件。
*   `src/lets-*`: 子插件目录，每个文件夹代表一个独立的子插件（如 `lets-bazaar`, `lets-format`）。
*   `src/libs/`: 公共库，核心基类 `BasePlugin.ts` 位于此处。
*   `src/translations/`: 国际化文件。

## 2. 子插件开发规范
所有子插件必须位于 `src/lets-*` 目录下，并拥有 `index.tsx` 作为入口。

### 2.1 继承 BasePlugin
子插件类必须继承自 `BasePlugin`：
```typescript
import { BasePlugin } from "@/libs/BasePlugin";

export default class MyPlugin extends BasePlugin {
  // ...
}
```

### 2.2 生命周期
*   `load()`: 插件启用时调用。在此处注册事件、Headbar 按钮等。
*   `unload()`: 插件禁用时调用。在此处清理事件、注销按钮。

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
4.  **实时响应**: 覆盖 `onConfigChanged(newConfig)` 钩子，以便在配置变更时实时更新插件行为（无需重载）。

### 2.4 Headbar 与菜单
*   **Headbar 按钮**: 如果插件需要在顶部栏显示按钮，请提供配置项 `headbarMode` ('standalone' | 'actions' | 'both')，并根据设置在 `load` 和 `onConfigChanged` 中调用 `registerHeadbar`。
*   **Actions Menu**: 覆盖 `getHeadbarMenuItems()` 方法，返回要插入全局“动作”菜单的列表项 (`MenuText`, `MenuSeparator` 等)。

### 2.5 国际化 (i18n)
*   所有用户可见字符串必须使用 `src/libs/l10n` 提供的 `t()` 函数包裹。
*   在 `src/translations/zhCN.ts` 中添加对应的中文翻译。

## 3. 开发流程与文档
1.  **复用优先**: 新功能优先考虑放入现有子插件，或提取公共方法至 `src/libs`。
2.  **查阅文档**: 开发前查看 `docs` 目录及本规则。
3.  **踩坑记录**: 遇到并解决的技术难题（如 API 限制、State 陷阱等），**必须**记录到 `walkthrough.md` 或 `docs` 下的相关文档中，以备后查。
4.  **严谨性**: 检查代码不使用不存在的 API，确保结构清晰、无明显 Bug。

最后：如无必要，勿增实体。使用中文回复。