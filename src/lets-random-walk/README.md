# 🎲 Random Walk (随机漫步)

A powerful tag-based random walk tool for Orca Note.
一款专为虎鲸笔记打造的、基于标签的强大随机漫步工具。

## ✨ Features (功能特性)

- **零配置侦测 (Zero-config Detection)**: Add a walk tag (e.g., `#随机漫步`) to any block, and it automatically becomes an independent random walk channel. / 为查询块或包含子节点的普通块打上“漫步标签”，即被自动识别为独立的漫步频道。
- **双模式支持 (Dual Mode Support)**:
  - **Query Blocks (查询块)**: Utilizes the native random engine to deal cards, ensuring no duplicate traversals. / 通过原生随机引擎自动发牌，无重复遍历。
  - **Normal Blocks (普通块)**: Automatically retrieves child nodes and performs a pure in-memory shuffle. / 自动获取其子节点并进行纯内存乱序洗牌。
- **自定义命名 (Custom Naming)**: Customize the `displayName` property of the walk tag to display clean and organized channel names in the list. / 支持为漫步标签配置 `displayName` 属性，在频道列表中显示规整的频道名称。
- **频道记忆 (Channel Memory)**: The main button intelligently remembers the last walked channel. / 主按钮智能记忆上一次漫步的频道，一键继续未完的探索。

## 🚀 Usage (使用方法)

1. 在虎鲸笔记设置 -> Sub-plugin Settings 中启用 **Random Walk** 插件。
2. 在你需要漫步的块（如查询出所有“书签”的查询块，或者包含几十句名人名言大纲的普通父块）上打上 `#随机漫步`（可以在插件设置中自定义该标签）。
3. 如果你想让下拉菜单中的名字更好看，可以点击标签，在属性面板中设置 `displayName` 为你想要的名字（例如“名人名言”）。
4. 点击顶部 Headbar 新出现的 🎲 骰子图标即可漫游你上次看过的频道，或将鼠标悬浮在图标上以在多个频道之间自由切换。
