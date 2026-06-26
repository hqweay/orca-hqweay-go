# CHANGELOG Convention

CHANGELOG.md must use clean plain text only — no markdown formatting symbols:

- **No `**bold**`** — use plain text or Chinese quotes.
- **No `` `code` ``** — use Chinese quotes or nothing.
- **No `###` headings inside list items** — always promote nested `###` to a proper `###` section header.
- **No commit hashes** as list item prefixes (`- dc3e69e: xxx` → `- xxx`).
- **No backticks or asterisks** anywhere in items.
- **Section names** use plain English (`### Features`, `### Improvements`, `### Bug Fixes`).
- **Version headings** omit the `v` prefix (`## 3.2.0`, not `## v3.2.0`).

## Correct Example

```markdown
## 3.2.0

### Features

- 编辑器层级折叠：新增精准控制主编辑器展示深度的子插件
  - 支持右键点击任意块，执行"展开至此同级"
  - 支持通过全局命令绑定快捷键，一键展开至第 1~5 层
```

## Rationale

The `changelog-parser.ts` uses simple regex to parse items. Markdown formatting in item text is invisible to the parser and displayed as raw symbols in the UpdateModal.
