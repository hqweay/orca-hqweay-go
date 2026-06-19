import { arcTabsState, LOCAL_STORAGE_KEY } from "./data";
import { arcTabsPluginInstance } from "../index";

const persistRecent = () => {
  try {
    localStorage.setItem(
      LOCAL_STORAGE_KEY,
      JSON.stringify(arcTabsState.recentlyVisited)
    );
  } catch (e) {
    console.error(e);
  }
};

export const addRecentBlock = (idNum: number, title: string, icon: string) => {
  const existingIdx = arcTabsState.recentlyVisited.findIndex(
    (item) => item.id === idNum
  );

  if (existingIdx !== -1) {
    let changed = false;
    const existing = arcTabsState.recentlyVisited[existingIdx];

    if (existing.title !== title && title) {
      const newIsGeneric = title.startsWith("Block ");
      const oldIsGeneric = existing.title.startsWith("Block ") || !existing.title;
      if (!(newIsGeneric && !oldIsGeneric)) {
        existing.title = title;
        changed = true;
      }
    }

    if (existing.icon !== icon && icon) {
      existing.icon = icon;
      changed = true;
    }

    if (changed) persistRecent();
    return;
  }

  const list = [...arcTabsState.recentlyVisited];
  list.unshift({ id: idNum, title: title || `Block ${idNum}`, icon: icon || "" });
  const todayLimit = arcTabsPluginInstance?.getSettings()?.todayLimit || 30;
  arcTabsState.recentlyVisited = list.slice(0, todayLimit);
  persistRecent();
};

export const removeRecentBlock = (idNum: number) => {
  arcTabsState.recentlyVisited = arcTabsState.recentlyVisited.filter(
    (item) => item.id !== idNum
  );
  persistRecent();
};
