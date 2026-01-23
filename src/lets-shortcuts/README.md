# Quick Tag Shortcuts Plugin

一个专门用于快速插入标签（Tags）的子插件。它会自动处理标签前后的空格，并确保标签格式正确。

## 功能

- 支持通过快捷键快速插入特定标签（如 `#碎碎念`、`#项目`）
- **智能空格处理**：
  - 如果光标前不是空格（且不在行首），自动插入前置空格。
  - 插入标签后自动追加后置空格，方便继续输入。
- **自动补全 `#`**：配置时可以省略 `#` 号，插件会自动补全。
- 支持动态更新快捷键配置。

## 配置方式

在插件设置中，找到 `tags.Tag Shortcuts Config` 配置项，输入 JSON 格式的配置数组：

```json
[
  {
    "tag": "碎碎念",
    "shortcut": "ctrl+shift+t"
  },
  {
    "tag": "TODO",
    "shortcut": "ctrl+alt+t"
  }
]
```

### 配置项说明

- `tag`: 标签内容（如 `碎碎念` 或 `#碎碎念`）。
- `shortcut`: 快捷键字符串，格式如 `ctrl+shift+k`、`meta+p`（macOS 上 meta 对应 Command 键）。

### 快捷键格式

- `ctrl+shift+k` - Windows/Linux 上的 Ctrl+Shift+K
- `meta+p` - macOS 上的 Command+P
- `alt+shift+k` - Alt+Shift+K
- 组合键用 `+` 连接

## 注意事项

1. 快捷键可能会与其他命令冲突，建议使用组合键。
2. 修改配置并保存后，插件会立即重新加载绑定。
3. 插入标签时，需要确保光标在编辑器中，否则会提示警告。
4. 插件会自动处理标签前后的空格，无需在配置中手动添加空格。
