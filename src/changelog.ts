export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "2.12.0",
    date: "2026-06-20",
    changes: [
      "新增链接工具 (Link Tools)：右键块链接/引用时支持快捷转换",
      "新增右键菜单注入：提取元数据、在网页视图打开",
      "精简块菜单：移除 lets-link-metadata 的块菜单选项",
      "修复 emoji 截断问题：转换为文本📌时正确处理多字节字符",
    ],
  },
  {
    version: "2.11.2",
    date: "2026-06-19",
    changes: [
      "优化 Arc 侧边栏：Today 改名为最近，支持动态日期图标",
      "优化侧边栏宽度锁定：使用 MutationObserver 防止重置",
      "优化拖拽交互：支持从编辑器拖拽块到侧边栏固定",
    ],
  },
  {
    version: "2.11.0",
    date: "2026-06-18",
    changes: [
      "新增侧边栏收集箱 (Roam Sidebar)：全局唯一的收集容器",
      "新增置顶块面板：支持网格/列表双布局",
      "优化块工具箱：新增归集子块功能",
    ],
  },
];

export function getChangesSince(lastVersion: string): ChangelogEntry[] {
  const idx = CHANGELOG.findIndex((e) => e.version === lastVersion);
  if (idx === -1) return CHANGELOG;
  return CHANGELOG.slice(0, idx);
}
