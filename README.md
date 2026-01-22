# Orca HQWEAY Go

[English](./README_en.md) | **中文**

[Orca Notes](https://github.com/hqweay/orca-notes) 的高级用户插件合集，采用模块化架构构建。

## 包含的插件

### 1. 语音笔记同步 (`lets-voicenotes-sync`)
与 [VoiceNotes.com](https://voicenotes.com) 双向同步。
- **功能**: 同步录音到每日日记，处理子笔记/附件，将区块推送到 VoiceNotes。
- [阅读文档](./src/lets-voicenotes-sync/README.md)

### 2. 发布到 GitHub (`lets-publish`)
将你的笔记变成博客。
- **功能**: 一键发布到 Jekyll/Hexo/Hugo 仓库，自动图床托管，智能增量更新。
- [阅读文档](./src/lets-publish/README.md)

### 3. 导入工具 (`lets-import`)
- **功能**:CSV 导入支持，用于批量数据迁移。

### 4. 格式化工具 (`lets-format`)
- **功能**: 文本清理，中英文混排自动空格处理。

### 5. 排序工具 (`lets-sort`)
- **功能**: 按字母顺序对子区块进行排序。

### 6. Orca 市场 (`lets-bazaar`)
- **功能**: 社区插件市场。在 Orca 内直接浏览、安装和更新插件。
- [阅读文档](./src/lets-bazaar/README.md)

## 开发

查看 [开发心得](./docs/dev-learnings.md) 了解开发过程中遇到的技术细节和 API 陷阱。

## 安装

将此仓库克隆到你的 Orca Notes 插件目录中。

```bash
cd /path/to/orca/plugins
git clone <repo-url> orca-hqweay-go
pnpm install
pnpm build
```
