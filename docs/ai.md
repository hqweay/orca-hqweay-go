这是一个 Orca Note 的插件项目，其中 orca-plugin-template 是官方示例插件，orca-plugin-template/plugin-docs 是插件开发文档。

src 目录下是插件的实现，目前项目实现了一套子插件注册机制，src/main.tsx 会扫描 src/lets-* 目录并注册子插件。

子插件放在 src/lets-* 目录下，每个子插件都有一个 index.tsx 文件作为入口， index.tsx 继承 src/libs/BasePlugin.ts 并实现相关方法。

子插件的配置面板参考：

```
	public getSettingsSchema() {
	return {
		[`${this.name}.token`]: {
			label: t(this.name + ".Token"),
			description: t("The Voicenotes API token."),
			type: "string",
		},
		[`${this.name}.inboxName`]: {
			label: t(this.name + ".Inbox name"),
			description: t(
				"The text used for the block where imported notes are placed under.",
			),
			type: "string",
			defaultValue: "VoiceNotes Inbox",
		},
		[`${this.name}.noteTag`]: {
			label: t(this.name + ".Note tag"),
			description: t(".The tag applied to imported notes."),
			type: "string",
			defaultValue: "VoiceNote",
		},
	};
```

每次我想要实现新功能时，你要考虑是否可以放在已有子插件下，还是新建一套子插件。

你需要查看插件文档后再根据插件 API 给出恰当的方案与实现。检查代码没有使用并不存在的命令，检查代码结构是否合理、易于维护且没有明显的 bug。