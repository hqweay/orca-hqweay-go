# Let's Embed View

一个 Orca Note 插件，支持嵌入 HTML、网页和 Twitter 等第三方内容。

## 功能

- **HTML 模式**：直接编写 HTML 代码并实时渲染
- **URL 模式**：输入网页 URL，通过 iframe 嵌入
- **Twitter/X 嵌入**：自动识别 Twitter/X 链接，使用官方 embed API
- **模式切换**：随时在 URL 和 HTML 模式之间切换

## 使用方法

1. 启用插件
2. 使用斜杠命令 `/embed-view.create` 创建嵌入块
3. 点击编辑按钮切换到编辑模式
4. 输入 URL 或 HTML 代码
5. 点击确认保存

## 技术细节

- 使用自定义块渲染器 (`type: "embed-view"`)
- 嵌入数据存储在块的 `_repr` 属性中
- 支持 Valtio 状态管理和实时预览
