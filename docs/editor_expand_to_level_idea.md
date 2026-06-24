# [Idea] 主编辑器：展开至指定层级 (Expand Editor to Level N)

> **状态：已搁置 (Pending/Archived)**
> **原因**：性价比 (ROI) 不高。主编辑器的日常使用场景更偏向于沉浸式写作，使用原生的 `foldAll` 和 `unfoldAll` 配合手动单点折叠已能覆盖 90% 以上需求。在主编辑器中实现“强制对齐到 N 层”，不仅使用频次低，还需要引入高风险的批量 IPC 操作（IPC 风暴），存在较大性能隐患。目前的结论是：优先满足侧边栏大纲导航的展开需求，主编辑器保持轻量。

如果你未来某天确实需要这个功能，可以直接参考以下成熟的架构设计方案。

---

## 1. 核心交互设计：所见即所得

相比于在 UI 上提供 `1/2/3/4/5/All` 这样的数字按钮，我们设计了两种更优雅、更符合直觉的交互路径：

- **块右键菜单 (Block Context Menu)**：只增加一个极简选项 —— **“展开至此同级 (Expand to this level)”**。用户右键点击任何一个块，整个编辑器立马动态折叠/展开，对齐到该块所在的深度层级！
- **全局编辑器命令 (Editor Commands)**：注册 `lets-editor-fold.expand-to-1` ~ `5`，让“键盘党”可以绑定快捷键（如 `Ctrl+1`）实现盲操。

## 2. 插件划分策略

**必须新建独立的子插件（如 `lets-editor-fold`）**，绝对不要强行塞进 `lets-editor-commands` 或 `lets-block-tools`。
因为这套方案包含复杂的深度测算、BFS 遍历以及批量 IPC 操作，逻辑非常重。让其作为一个独立插件存在，既能保证代码的单一职责（Single Responsibility），也方便用户在设置面板中对其进行独立开关。

## 3. 核心算法与性能极致优化 (最小化 IPC 调用)

由于 Orca 并没有原生的 `core.editor.foldToLevel` API，如果强行对整个文档的每一个块发送状态修改指令，会引发极其严重的 **IPC 拥塞风暴**（Electron 架构下，瞬间几千个进程间通信会导致渲染进程彻底卡死）。

为此，必须采用 **“精准打击”** 的 BFS (广度优先搜索) 策略：

1. **溯源取根**：沿着 `orca.state.blocks` 向上溯源，找到当前页面的根节点 (`rootBlockId`)。
2. **计算目标深度**：如果是右键触发，动态计算被右键点击的块距离根节点的深度 `N`。如果是快捷键触发，则直接取绑定的数字 `N`。
3. **BFS 扫描与精准分类**：获取 `get-block-tree`，遍历整个树：
   - 深度 `< N` 的块：必须展开，加入 `blocksToUnfold` 数组。
   - 深度 `== N` 的块：必须折叠，加入 `blocksToFold` 数组。
   - 深度 `> N` 的块：**直接跳过，不作任何处理！**（因为只要第 N 层被折叠了，它们必然隐藏。省去这部分的遍历，可以避免对深层节点发送无意义的 IPC 请求，节省 90% 以上的性能开销）。

## 4. 执行阶段伪代码

使用 `Promise.all` 批量并发派发核心折叠命令，尽最大可能缩短 UI 阻滞感：

```typescript
// 伪代码示例
await Promise.all([
  ...blocksToFold.map(id => 
    orca.commands.invokeEditorCommand("core.editor.foldBlock", null, id)
  ),
  ...blocksToUnfold.map(id => 
    orca.commands.invokeEditorCommand("core.editor.unfoldBlock", null, id)
  )
]);
```
