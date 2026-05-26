# macOS 日历与提醒事项同步插件 (lets-mac-sync)

这是 Orca Note 的一个核心子插件，能够将 macOS 系统内置的**日历 (Calendar)** 日程以及**提醒事项 (Reminders)** 待办完美无缝地同步到您的 **每日日记 (Daily Journal)** 中，并提供高级的**动态滚动（Roll-Forward）**和**双向状态同步**机制。

---

## 🌟 核心特性

1. **Daily Journal 深度集成**：
   - 自动根据日历日程的时间将日程插入到对应日期的 Daily Journal 中的 `macOS Calendar` 块下。
   - 自动根据提醒事项的截止日期（Due Date）将其插入对应日期的 Daily Journal 中的 `macOS Reminders` 块下。

2. **动态滚动（Roll-Forward）收件箱**：
   - 对于在收件箱中**没有截止日期且未完成**的提醒事项，插件会自动将其同步至**“今天”**的 Daily Journal。
   - 如果到了第二天该事项依然处于**未完成**状态，再次同步时插件会自动将其**无缝迁移（Move）到今天新的 Daily Journal** 中。一旦其被标记为已完成，它就会完美留存在完成当天的日记中。

3. **双向完成状态同步**：
   - 如果您在 Orca Note 中勾选完成了带有 `#AppleReminder` 标签的提醒事项块（或者将属性中的 `Status` 改为 `"Completed"`），当再次同步时，插件会反向通过 macOS 系统的 JXA 桥梁，自动**将系统自带 Reminders App 中的对应待办事项标记为完成**。
   - 如果在系统 Reminders 中勾选了完成，同步时也会同步更新 Orca 中的块和状态。

4. **高级增量去重**：
   - 给导入的块打上 `#AppleReminder` 和 `#AppleCalendar` 标签，并将其在 macOS 上的唯一 UUID 保存为 `ID` 属性。
   - 每次同步均通过唯一的 UUID 属性在数据库中进行增量查询和更新，**绝对不会产生多余的重复数据块**。

---

## 🛠️ 配置选项

您可以在**子插件设置面板**中针对该同步进行精细调整：

1. **同步 macOS 提醒事项 (Sync macOS Reminders)**：是否启用提醒事项同步。
2. **提醒事项列表过滤 (Reminder Lists)**：可填写逗号分隔的列表名称（如 `工作, 个人`），留空则同步系统内所有列表。
3. **提醒事项容器标题 (Reminder Inbox Heading)**：Daily Journal 下分类块的标题名称（默认：`macOS Reminders`）。
4. **同步 macOS 日历 (Sync macOS Calendar)**：是否启用日历同步。
5. **日历过滤 (Calendar Names)**：可填写逗号分隔的日历分类（如 `工作, 个人`），留空则同步所有日历。
6. **日历范围 (Calendar Range)**：选择要同步的日程时间范围（`仅今天`、`今天与明天`、`本周`）。
7. **日历日程容器标题 (Calendar Inbox Heading)**：Daily Journal 下日历分类块的标题名称（默认：`macOS Calendar`）。
8. **自动同步间隔 (Auto Sync Interval)**：设置后台自动同步的时间间隔（分钟），设为 `0` 则关闭自动后台同步。

## 🔒 本地同步助手与安全说明

* **沙盒环境限制**：
  现代 Electron 客户端（如当前运行的 Orca Note 1.78.0）出于安全考量，在前端渲染窗口中**完全禁用了 Node.js 集成**（NodeIntegration = false）。这导致所有前端运行的插件均无法在编辑器内部直接执行系统命令行工具。

* **解决方案（本地同步助手）**：
  为了打破这一安全隔离，我们设计并集成了一个零依赖的**本地同步助手（Mac Sync Companion Server）**，存放于 `src/lets-mac-sync/sync-server.js`。您只需在终端中运行该助手，它将在本地启动一个超轻量的 HTTP 接口。
  我们的 `lets-mac-sync` 插件将通过本地安全的 `fetch` API 瞬间与助手连通，实现免沙盒限制的 macOS 原生数据读取与双向完成同步！

* **启动本地助手**：
  请在您的项目根目录下打开终端，运行以下命令启动服务：
  ```bash
  node src/lets-mac-sync/sync-server.js
  ```
  控制台输出 `macOS Sync Companion Server running at http://localhost:9090` 即代表启动成功。您可以让它常驻后台运行。

* **系统权限申请**：
  在**首次触发同步时**，macOS 会自动弹出系统级的权限申请弹窗（*“终端 想要访问您的提醒事项/日历”*），请点击**“允许”**。

---

## 🚀 立即体验

1. 在终端中运行 `node src/lets-mac-sync/sync-server.js` 启动本地助手。
2. 打开 Orca Note 子插件设置，启用 `mac-sync` 插件。
3. 在右上角顶栏动作菜单中会出现 **同步 macOS 数据** 动作，或点击顶栏新出现的 **Apple 图标按钮**。
4. 点击即可立刻将您的 macOS 系统日程与待办抓取至您的 Daily Journal 日记中！
