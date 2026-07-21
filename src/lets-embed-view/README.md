# Let's Embed View

一个 Orca Note 插件，支持嵌入 HTML、网页 URL 和 Twitter/X 等第三方内容。

## 功能

- **URL 模式**：输入网页 URL，使用 webview 渲染（绕过 CSP `frame-ancestors` 限制）
  - Header 显示网站图标 + 域名
  - 支持点击"在浏览器中打开"
- **HTML 模式**：直接编写 HTML 代码，支持实时渲染
  - 无脚本 HTML 使用 iframe（轻量，无快捷键冲突）
  - 含脚本 HTML 使用 webview（自动高度 + Cmd+R 快捷键拦截）
- **Twitter/X 嵌入**：自动识别 Twitter/X 链接，支持 Embed（oEmbed API）和 Card（platform iframe）两种展示模式
- **拖拽调整高度**：所有嵌入内容均支持拖拽调整显示高度
- **密码持久化**：webview 使用独立分区存储（`partition="persist:embed"`），保持登录状态

## 使用方法

1. 启用插件
2. 使用斜杠命令 `/embed-view.create` 创建嵌入块
3. 点击编辑按钮切换到编辑模式
4. 输入 URL 或 HTML 代码
5. 点击确认保存

## 技术细节

- 使用自定义块渲染器 (`type: "embed-view"`)
- 嵌入数据存储在块的 `_repr` 属性中
- 适配器模式：`twitterAdapter` 优先匹配 Twitter/X 链接，`webviewAdapter` 作为通用 fallback
- HTML 模式自动检测 `<script>` 标签，决定使用 iframe 或 webview
