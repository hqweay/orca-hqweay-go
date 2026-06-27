import { proxy } from "valtio";

export const getLocalStorageKey = () => `orca-arc-tabs-recent-${orca.state.repo || 'default'}`;
export const DEFAULT_SPACE = "🪐";

export let __arcTabsScrollTop = 0;
export const setArcTabsScrollTop = (v: number) => { __arcTabsScrollTop = v; };

export interface RecentTab {
  id: number;
  title: string;
  icon: string;
}

export const arcTabsState = proxy({
  pinnedBlocks: [] as any[],
  pinnedDisplayMode: "grid" as "grid" | "list",
  spaceChoices: [] as string[],
  lastActiveEditorPanelId: null as string | null,
  recentlyVisited: (() => {
    try {
      const saved = localStorage.getItem(getLocalStorageKey());
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
