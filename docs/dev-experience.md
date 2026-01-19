# 开发经验总结 (Sort Plugin Development)

本文档记录了在开发 Orca Note 插件（特别是 Block Sort 功能）过程中遇到的坑和经验，供后续开发参考。

## 1. 核心 API 差异

### `core.editor.moveBlocks`
*   **误区**：容易凭直觉认为移动单个块的命令是 `core.editor.moveBlock`。
*   **真相**：实际存在的命令是 **`core.editor.moveBlocks`** (复数形式)，即使只移动一个块也需要传入数组。
*   **签名**：
    ```typescript
    invokeEditorCommand(
      "core.editor.moveBlocks",
      cursor: null,
      blockIds: number[], // 必须是 ID 数组
      refBlockId: number,
      position: "before" | "after" | "firstChild" | "lastChild"
    )
    ```

## 2. 块数据结构 (Block Data Structure)

### 任务块识别 (Task Identification)
Orca 中的 Task 块并不一定在顶层 `type` 中标识，而是依赖 `properties` 中的 `_repr` 属性。

*   **结构示例**：
    ```json
    {
      "id": 2453,
      "properties": [
        {
          "name": "_repr",
          "type": 0,
          "value": {
            "type": "task", // 或 "todo", "checklist"
            "state": 1      // 1 = Checked/Done, 其他 = Unchecked
          }
        }
      ]
    }
    ```
*   **判断逻辑**：
    1.  查找 `block.properties` 中 `name === '_repr'` 的项。
    2.  检查 `item.value.type` 是否为 `"task"`。
    3.  检查 `item.value.state` 判断状态 (`1` 为完成)。

## 3. 插件配置 (Settings)

### Class-based Plugin 配置
在继承 `BasePlugin` 的类中，直接实现 `getSettingsSchema()` 方法即可自动注册配置项。

```typescript
public getSettingsSchema(): any {
    return {
        "config.key": {
            label: "配置名称",
            description: "配置描述",
            type: "string", // 或 "boolean", "number"
            defaultValue: "default_value",
        },
    };
}
```
*   **读取配置**：`orca.state.plugins[this.mainPluginName]?.settings?.["config.key"]`

### 命名空间 (Namespace)
为了避免与其他插件的配置项发生冲突，建议使用动态 Key，包含插件名称：

```typescript
// 定义
[`${this.name}.option`]: {
    label: t(this.name + ".Option Label"), // Label 也加上前缀，方便在设置界面区分
    ...
}

// 读取
settings[`${this.name}.option`]
```
这样可以确保 Key 的唯一性，并且在统一的设置界面中，用户能清晰分辨该配置属于哪个子插件。

## 4. 排序逻辑实现细节

*   **自定义排序顺序**：可以将排序的 key（如 `'empty', 'task'`）存入配置字符串，在代码中通过 `indexOf` 确定权重。
*   **非连续选择**：`core.editor.moveBlocks` 可以处理非连续的 `blockIds`，将其移动到指定 `refBlockId` 的相对位置，从而实现“归拢”效果。

## 5. 开发流程建议

1.  **查阅 `plugin-docs`**：遇到 API 问题（如命令名称），优先在 `orca-plugin-template/plugin-docs/documents` 下搜索（如 `grep` 搜索 `Core-Editor-Commands.md`）。

## 6. 发布插件踩坑总结 (Publish Plugin Lessons)

### GitHub API 与 缓存
*   **问题**：`fetch` 获取 GitHub 文件信息（如 `getFileSha`）时，如果之前请求过一次 404（文件不存在），浏览器或代理可能会缓存这个 404 响应。导致后续即使文件上传成功，再次查询 SHA 依然返回 404，引发重复创建或更新失败。
*   **解决**：
    1.  API URL 添加时间戳参数：`?t=${Date.now()}`。
    2.  `fetch` 选项设置 `cache: "no-store"`。

### Token 处理
*   **坑**：用户复制 Token 时很容易带上首尾空格，导致认证失败。
*   **解决**：使用 Token 前务必 `.trim()`。

### 属性存储 (Property Storage)
*   **概念区分**：
    *   `block.properties`: 块自身的属性（如 type, checked status 等）。
    *   `block.refs[].data`: 挂在块上的标签（引用）所携带的属性。
*   **最佳实践**：元数据（如 `slug`, `blog_path`）建议存储在特定的 Tag（如“已发布”）的 `ref.data` 中，而不是污染块本身的属性。
*   **Tag 属性过滤**：获取文章 Tags 时，记得排除用于标记状态的功能性 Tag（如 "已发布"）。

### 时间格式 (Date Formatting)
*   **date-fns 坑**：format 字符串中 `XXX` 会输出时区偏移（如 `+08:00`）。
*   **Frontmatter**：某些静态网站生成器（或 YAML 解析器）对时区格式支持不一。最稳妥的方式是输出 **双引号包裹的** 标准时间字符串 `"yyyy-MM-dd HH:mm:ss"` (本地时间)，避免自动解析出错了。

### 图片上传与去重
*   **策略**：不要每次都重新生成随机文件名上传。
*   **优化**：
    1.  提取图片文件名（解码 URL）。
    2.  检查 Image Bed 是否已存在同名文件 (HEAD request or getFileSha)。
    3.  如果存在，直接复用 `download_url`，节省流量和仓库空间。

