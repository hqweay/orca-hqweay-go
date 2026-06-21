---
"orca-hqweay-go": patch
---

- 提取并复用了块元信息解析逻辑：在 `libs/utils.ts` 中新增了 `getBlockTitle`, `getBlockIcon`, `getBlockColor` 公共函数，并在 `libs/components` 中抽离了 `<BlockIcon />` 渲染组件。
- 优化了 `lets-block-nav` 侧边栏：现在完美支持展示节点的自定义图标、日历图标以及自定义颜色了。
- 重构了 `lets-arc-tabs` 插件，将其原本冗余的内部图标/颜色/标题获取逻辑接入了新的 `libs` 公共方法中。
