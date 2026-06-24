# Changelog

## 3.2.0

### Minor Changes

- dc3e69e: ### ✨ 新特性 (Features)
  - **编辑器层级折叠 (`lets-editor-fold`)**：新增了精准控制主编辑器展示深度的子插件。
    - 支持右键点击任意块，执行“展开至此同级”。
    - 支持通过全局命令绑定快捷键，一键展开至第 1~5 层。
- 000cb56: - 大纲导航新增快照式层级展开功能，可一键将大纲视图展开至指定层级 (1/2/3/All)，解决局部展开与全局状态的冲突问题
  - 为高级用户（键盘党）注册了全局编辑器命令 `大纲导航：展开至层级 1~5` 以及 `大纲导航：展开全部`，方便绑定快捷键，实现类 Org-mode 的极速展开体验
  - 优化交互反馈：大纲侧边栏底部展开按钮现支持多模式联动操作。左键单展侧边栏；右键单展主编辑器；按住 Alt / Shift 键点击则**同时**展开侧边栏与主编辑器，提供极致的双屏沉浸控制。

## 3.1.1

### Patch Changes

- afa9d28: - 新增大纲导航设置项：隐藏内置大纲（hideBuiltInToc）。开启后，在大纲导航面板激活时会自动隐藏 Orca 内置的大纲面板及触发展开按钮，关闭面板或卸载插件时自动复原。

## 3.1.0

### Minor Changes

- e70eec2: - feat(block-nav): 新增大纲树快捷过滤功能
  - 支持快捷点击「标题」、「待办」、「已办」，一键提取文档骨架与任务视图。可以替代目录啦。
  - 支持在搜索框输入指令查询（如 `is:heading`、`is:todo`、`is:done`），可与普通文本搜索组合使用。
- ab99be0: - feat(block-nav): 优化点击导航交互
  - 左键点击：编辑器平滑滚动定位到目标块（侧边栏保持全局大纲视图）。
  - `Alt/Option` + 左键点击：编辑器下钻（Zoom In）到该块。
  - 右键点击：呼出上下文菜单，提供快捷转换等功能。

## 3.0.0

### New Features

- 新增大纲导航

### Improvements

- 新增侧边栏配置项：大纲导航 (Block Nav) 和 Arc 侧边栏现在支持通过设置配置默认在左侧还是右侧打开
- 新增侧边栏快捷操作：右键点击侧边栏图标，或按住 Shift 点击，可以在屏幕反方向立刻唤出面板

## v2.12.0

### New Features

- 新增链接工具 (Link Tools)：右键块链接/引用时支持快捷转换
- 新增右键菜单注入：提取元数据、在网页视图打开
- 新增「关于」页面：展示插件信息、相关链接、更新日志

### Improvements

- 优化更新说明：使用弹窗替代外部链接

### Bug Fixes

- 修复 emoji 截断问题：转换为文本 📌 时正确处理多字节字符

## v2.11.0

### New Features

- 新增 Arc 侧边栏 (Arc Tabs)：类 Arc 浏览器的标签页管理
- 新增侧边栏收集箱 (Roam Sidebar)：全局唯一的收集容器
- 新增置顶块面板：支持网格/列表双布局

### Improvements

- 优化块工具箱：新增归集子块功能

## v2.9.0

### New Features

- 新增 Arc 侧边栏初始版本
- 新增 Roam 侧边栏初始版本

## v2.7.0

### New Features

- 新增块流转 (Block Flow)：快速将块发送到指定位置

## v2.6.0

### New Features

- 新增隐私块 (Privacy Block)：保护敏感内容

## v2.5.0

### New Features

- 新增块工具箱 (Block Tools)：增强块右键菜单

## v2.4.0

### New Features

- 新增智能剪贴板注入：支持 JSON 解析为虎鲸块

## v2.3.0

### New Features

- 新增随机漫步 (Random Walk)：基于标签的知识探索

## v2.2.0

### New Features

- 新增脑图视图 (Mind Map)：将笔记渲染为思维导图

## v2.1.0

### New Features

- 新增块嵌入子项支持 (Embed Children)

## v2.0.0

### New Features

- 新增记忆复习 (SRS)：基于 FSRS 算法的间隔重复

## v1.x

### Initial Release

- 一键格式化 (Format Block)
- VoiceNotes 同步
- 导入工具 (Import)
- 样式清除 (Remove Style)
- 块排序 (Sort Blocks)
- 发布到 GitHub (Publish)
- 插件市集 (Bazaar)
- 快捷标签 (Quick Tag)
- 标题层级整理 (Heading Tree)
- 网页助手 (Web Assistant)
- 编辑器扩展命令 (Editor Commands)
