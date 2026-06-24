const lines = [
  "- dc3e69e: ### ✨ 新特性 (Features)",
  "  - **编辑器层级折叠**",
  "- 000cb56: - 大纲导航新增快照式层级展开功能",
  "  - 为高级用户（键盘党）注册了全局编辑器命令",
];

for (const line of lines) {
  const match = line.match(/^\s*-\s+(.+)/);
  if (match) {
    const cleaned = match[1]
      .replace(/^[a-f0-9]{7}:\s*/, "")
      .replace(/^-\s*/, "");
    console.log(cleaned);
  }
}
