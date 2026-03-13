# Quick Tag Shortcuts Plugin

一个专门用于快速插入标签（Tags）的子插件。它会自动处理标签前后的空格，并确保标签格式正确。

## 功能

- 支持通过快捷键快速插入特定标签（如 `#碎碎念`、`#项目`）。
- **默认属性支持**：在一键插入标签时，自动为标签附加预设的属性值（如状态、日期、优先级等）。
- **智能空格处理**：
  - 如果光标前不是空格（且不在行首），自动插入前置空格。
  - 插入标签后自动追加后置空格，方便继续输入。
- **自动补全 `#`**：配置时可以省略 `#` 号，插件会自动补全。
- **从剪贴板粘贴标签 (Paste Tags)**：
  - 支持从剪贴板解析 JSON 批量插入标签及属性。
  - 支持 **富文本 (ContentFragment)**：在批量操作时可同时插入带链接、提醒或格式化的文本内容。
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
- `defaults`: (可选) 默认属性配置数组。

```json
{
  "tag": "MyTag",
  "shortcut": "ctrl+alt+m",
  "defaults": [{ "name": "Status", "value": "Todo", "type": 1 }]
}
```

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

## 从剪贴板粘贴标签 (Paste Tags)

插件支持通过命令 `Shortcuts: Paste Tags from Clipboard` 从剪贴板读取 JSON 数据并插入标签。

可在设置中配置该功能的全局快捷键。

### 支持的 JSON 格式

**1. 推荐格式 (Envelope)**

包含类型标识，更安全，避免误识别。

`primaryKey` 可以是字符串（全局唯一键名）或对象（为每个标签指定唯一键名）。

`downloadImages` 为 `true` 时，会自动下载属性中的远程图片（`typeArgs: { subType: "image" }`）。

```json
{
  "type": "orca-tags",
  "content": [
    { "t": "t", "v": "Check our " },
    { "t": "l", "v": "Orca Documentation", "l": "https://orca.so/docs" }
  ],
  "primaryKey": {
    "任务标签": "参考链接"
  },
  "downloadImages": true,
  "tags": [
    {
      "任务标签": [
        {
          "name": "状态",
          "type": 6,
          "value": ["进行中", "高优先级"]
        },
        {
          "name": "进度",
          "type": 3,
          "value": 75
        },
        {
          "name": "已归档",
          "type": 4,
          "value": false
        },
        {
          "name": "参考链接",
          "type": 1,
          "value": "https://leay.net",
          "typeArgs": { "subType": "link" }
        },
        {
          "name": "封面",
          "type": 1,
          "value": "https://raw.githubusercontent.com/hqweay/picbed/master/img/avatar/avatar.png",
          "typeArgs": { "subType": "image" }
        }
      ]
    }
  ]
}
```




### 属性对象结构

```typescript
interface Property {
  name: string; // 属性名
  type: number; // 属性类型 (1: Text, 2: Number, 3: TextChoices, 4: DateTime, 5: Boolean)
  value: any; // 属性值 (多选类型可传字符串数组)
  typeArgs?: any; // 类型参数 (如 { subType: "link" } 或 { choices: [...] })
}
```

## TODO

- [ ] 属性的 value 支持使用 js 代码 (e.g. `new Date().toISOString()`)
