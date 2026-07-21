---
trigger: always_on
---

# lets-embed-view 开发记录

## 块类型转换

Orca 没有 `setBlockType` 命令。块类型完全由 `_repr` 属性控制，通过 `core.editor.setProperties` 修改 `_repr` 即可原地转换块类型：

```typescript
await orca.commands.invokeEditorCommand(
  "core.editor.setProperties",
  null,
  [blockId],
  [{ name: "_repr", type: 0, value: { type: "lets.embed-view", mode: "html", html: "" } }],
)
```

## 适配器模式

每个 `EmbedAdapter` 包含：
- `match(url)` — 匹配 URL 的正则或函数
- `modes` — 模式名到渲染组件的映射（`Record<DisplayMode, Component>`）
- `defaultMode` — 默认模式

`EmbedPreview` 根据 `availableModes.length > 1` 决定是否显示模式切换 UI。适配器按注册顺序匹配，优先匹配到先注册的适配器。

## Webview vs Iframe

| | Webview | Iframe |
|---|---|---|
| 进程 | 独立 Chromium 渲染进程 | 共享主窗口进程 |
| CSP | 不受父窗口限制 | 继承父窗口 CSP |
| Cookie | partition 隔离 | 共享主窗口会话 |
| 重量 | 重，独立进程 | 轻 |
| DevTools | 隔离 | 主窗口统一 |
| X-Frame-Options | 不适用 | 被阻拦时无法显示 |

### 使用原则
- **URL 模式**：统一 webview（`partition="persist:embed"` + `allowpopups` + `ResizableBox`），避免 iframe 被主流网站 CSP 阻止
  - Twitter/X 使用专用适配器（embed oEmbed / card platform iframe），优先匹配
  - webviewAdapter 作为 fallback 匹配所有其他 URL
  - iframeAdapter 已停用（不再注册），保留文件备查
- **HTML 模式**：自动检测是否存在 `<script>` 标签
  - 无脚本：使用 iframe（blob URL），避免 webview 键盘快捷键冲突
  - 含脚本：使用 webview + 键盘拦截（`Cmd+R` 注入 `preventDefault` + `console-message` 通信）
  - webview 含 `onHeightChangeRef` 防止渲染循环 + `injectedRef` 防止重复注入

### displayMode 迁移
- 存量块可能有 `displayMode: "iframe"`（来自旧 iframeAdapter）
- `EmbedViewRenderer` 自动检测：如果 `displayMode` 不在当前适配器的可用模式中，重置为 `adapter.defaultMode`
- 重置仅在本地 state，下次用户操作时持久化

### 自动高度策略
- webview：`executeJavaScript` 读取 `scrollHeight`，存本地 `contentHeight` state，不触发 store save
- iframe：不支持自动高度，依赖 `ResizableBox` 手动拖拽

## 按钮样式规范（Orca CSS 变量）

- 实心底色用 `--orca-color-primary-5`（不是 `--orca-color-primary`，后者在浅色主题下可能解析成浅色值）
- 文字用 `#fff`
- hover 用 `--orca-color-primary-6`
- mode toggle 按钮不要加 hover 效果（hover 会覆盖 active 背景色）

## Twitter Embed 自动高度

`platform.twitter.com/embed/Tweet.html` 通过 `postMessage` 发送高度信息：
```typescript
{
  type: "twttr.embed.height",
  height: number,
  // ...
}
```

监听方案：
```typescript
useEffect(() => {
  const handler = (event: MessageEvent) => {
    if (event.origin !== "https://platform.twitter.com") return
    const data = event.data
    if (data?.type === "twttr.embed.height" && typeof data.height === "number") {
      setHeight(data.height)
    }
  }
  window.addEventListener("message", handler)
  return () => window.removeEventListener("message", handler)
}, [tweetId])
```

初始高度设 400px（足够大多数推文），收到 postMessage 后精调。iframe 加 `overflow: hidden` 隐藏高度切换瞬间的闪烁。

## 新建块默认进编辑模式

```typescript
const [editing, setEditing] = useState(!(repr.mode && (repr.url || repr.html)))
```

有内容时预览，无内容时直接进入编辑状态。
