---
trigger: model_decision
description: 该 rule 指定了如何理解并开发该项目，每次进行开发时都需要首先阅读该 rule。
---

这是一个 Orca Note 的插件项目，其中 orca-plugin-template 是官方示例插件，orca-plugin-template/plugin-docs 是插件开发文档。

src 目录下是插件的实现，目前项目实现了一套子插件注册机制，src/main.tsx 会扫描 src/lets-* 目录并注册子插件。

子插件放在 src/lets-* 目录下，每个子插件都有一个 index.tsx 文件作为入口， index.tsx 继承 src/libs/BasePlugin.ts 并实现相关方法。

子插件的配置面板参考：

```
  getSettingsSchema(): any {
    return {
      // Image Bed Settings
      ...this.defineSetting(
        "imageBed.owner",
        "Image Bed Owner",
        "GitHub Username/Org for Image Bed",
      )
    }
  }
```

defineSetting 的实现在 src/libs/BasePlugin.ts。

使用：const ibOwner = settings[`${this.name}.imageBed.owner`];

每次我想要实现新功能时，你要考虑是否可以放在已有子插件下，还是新建一套子插件。如果可以提取公共方法，放在 src/libs 下。

你可以参考目前的 lets-* 文件夹下插件的开发规范。

你可以参考目前的 docs 文件夹之前踩过的坑。

你需要查看插件文档后再根据插件 API 给出恰当的方案与实现。检查代码没有使用并不存在的命令，检查代码结构是否合理、易于维护且没有明显的 bug。

对开发过程中总结的经验保存到 docs 目录下，方便后续复用。每次开发前可以先查看一下 docs 目录。

开完完成后你需要将踩过的坑总结到 docs，并为子插件 readme，主插件的 readme 进行补充。

最后：如无必要，勿增实体。使用中文回复。