# 虎鲸笔记插件：恐龙工具箱

一个为 [Orca Note](https://orca.pet) 打造的增强插件集合。日常笔记里那些繁琐、重复的操作——排版、归档、回顾、发布、收集——这里都有对应的开箱即用工具。

**一句话**：不用切到别的软件，在虎鲸笔记里就能完成记笔记之外的大部分事。

## 安装与使用

1. 下载 Release 中的 `package.zip`。
2. 解压后，将整个文件夹复制到 Orca Note 的插件目录。
3. 在软件设置中刷新并启用插件。所有子功能均可在「插件设置」中单独开启或关闭。

## 功能一览

每个功能都有独立详情页，点击功能名查看（摘要与该页不一致时以详情页为准）。

| 功能 | 一句话 |
| --- | --- |
| [📝 一键格式化](./src/lets-format/README.md) | 中文排版：标点、空格、全半角一键规范化。 |
| [🎙️ VoiceNotes 同步](./src/lets-voicenotes-sync/README.md) | 把 voicenotes.com 的录音笔记同步并自动归档进虎鲸笔记。 |
| [📂 导入工具](./src/lets-import/README.md) | 批量导入 Markdown 文件夹，CSV 智能解析为笔记节点。 |
| [🧹 样式清除](./src/lets-remove-style/README.md) | 一键清理行内样式、链接、空行，标题层级互相转换。 |
| [🔃 块排序](./src/lets-sort/README.md) | 自定义排序预设，按块类型优先级智能排序同级块。 |
| [📤 发布到 GitHub](./src/lets-publish/README.md) | 笔记一键发布为博客：图片上传图床、自动生成 Frontmatter。 |
| 🏪 插件市集 | 应用内社区插件市场：浏览、安装、更新、卸载，支持自定义第三方源。 |
| 🏷️ 快捷标签 | 快捷键在光标处插入常用标签，可自动附带状态、优先级等属性。 |
| [🌳 标题层级整理](./src/lets-heading-tree/README.md) | 按 H1–H4 自动重组文档树，普通文本归到最近的标题下。 |
| [🌐 网页助手](./src/lets-browser/README.md) | 沉浸式浏览器 + 网页元数据提取 + Markdown 剪藏。 |
| [🧠 记忆复习](./src/lets-srs/README.md) | 基于 FSRS 的记忆工具，支持问答 / 沉浸阅读与标签 / 查询漫游。 |
| 🪞 块嵌入子项增强 | 镜像引用块自动展示子块内容，随用户脚本模板库使用。 |
| [🎲 随机漫步](./src/lets-random-walk/README.md) | 随机探索指定标签下的知识片段，无重复发牌。 |
| [📋 智能剪贴板注入](./src/lets-paste-blocks/README.md) | 粘贴外部 JSON 为原生笔记节点，支持标签、属性与图片转存。 |
| [🛠️ 块工具箱](./src/lets-block-tools/README.md) | 子块归集、父节点置顶 / 置底、链接与引用格式互转。 |
| [🔒 隐私块](./src/lets-test-privacy/README.md) | 一键藏起敏感内容，向 AI 屏蔽且不影响日常编辑。 |
| [🌊 块流转](./src/lets-block-flow/README.md) | 右键把选中块发送 / 移动 / 引用至今日、明日日志或收件箱。 |
| [📌 置顶块面板](./src/lets-pinned-blocks/README.md) | 打上标签即固定到侧边栏，随时唤回高频笔记。 |
| [🪐 Arc 侧边栏](./src/lets-arc-tabs/README.md) | 多空间隔离、固定标签拖拽排序的现代侧边栏与浏览历史。 |
| [📥 全局收集箱](./src/lets-roam-sidebar/README.md) | 复刻 Roam 的全局收集交互，原生块跨页拖拽收集。 |
| [🔗 链接工具](./src/lets-link-tools/README.md) | 超链接与块引用、图钉（📌）引用格式快捷互转。 |
| [🌳 大纲导航树](./src/lets-block-nav/README.md) | 侧边栏大纲导航：跳转、下钻、实时检索与折叠联动。 |
| [🔗 收集引用](./src/lets-gather-refs/README.md) | 一键汇总当前文档的反向引用，生成 MOC / 索引列表。 |
| [🧊 编辑器层级折叠](./src/lets-editor-fold/README.md) | 「展开至此同级」与自动截断深层的折叠命令。 |
| [🕸️ 足迹图谱](./src/lets-local-graph/README.md) | 侧边栏实时关系图谱，支持过滤、拓展与回放探索。 |
| [🖼️ 嵌入视图](./src/lets-embed-view/README.md) | 在笔记里嵌入网页 / HTML / Twitter，支持卡片市场与沙箱渲染。 |
| [📜 用户脚本](./src/lets-inject/README.md) | 代码块打 `#脚本` 标签即可注入脚本 / 样式，内置模板库。 |
| [🤖 AI 助手](./src/lets-ai/README.md) | 选中文本用 AI 解释、翻译、润色、打标签或执行自定义指令。 |
| [⏱️ 时间统计](./src/lets-time-log/README.md) | 标签打点自动聚合为日 / 周 / 月时间线与统计、目标与 AI 分析。 |
| [🛠️ 工作台](./src/lets-workbench/README.md) | 用一句话让 AI 组装图表、卡片与原生组件的信息面板。 |

---

## 开发说明

模块化架构，每个功能独立成 `src/lets-*` 目录，由 `main.tsx` 动态加载启用的子插件。更多约定见 [`AGENTS.md`](./AGENTS.md)。
