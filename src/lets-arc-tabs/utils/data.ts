import { proxy } from "valtio";

export const LOCAL_STORAGE_KEY = "orca-arc-tabs-recent";

export interface RecentTab {
  id: number;
  title: string;
  icon: string;
}

export const arcTabsState = proxy({
  pinnedBlocks: [] as any[],
  pinnedDisplayMode: "grid" as "grid" | "list",
  spaceChoices: [] as string[],
  recentlyVisited: (() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed.map((item: any) => {
          if (typeof item === "object" && item !== null && "id" in item) {
            return {
              id: Number(item.id),
              title: String(item.title || ""),
              icon: String(item.icon || ""),
            };
          }
          return { id: Number(item), title: "", icon: "" };
        });
      }
      return [];
    } catch {
      return [];
    }
  })() as RecentTab[],
});
