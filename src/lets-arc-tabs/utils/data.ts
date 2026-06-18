import { DataImporter } from "@/libs/DataImporter";
import { arcTabsPluginInstance } from "../index";
import { proxy } from "valtio";
import { findMainPanelId } from "./nav";

const revertOptimisticPin = (idNum: number, spaceId: string) => {
  arcTabsState.pinnedBlocks = arcTabsState.pinnedBlocks.filter(
    (b) => b.id !== idNum,
  );

  const orderObj = { ...arcTabsState.pinnedOrder };
  const orderArray = [...(orderObj[spaceId] || [])];
  const idx = orderArray.indexOf(idNum);
  if (idx !== -1) {
    orderArray.splice(idx, 1);
    orderObj[spaceId] = orderArray;
    arcTabsState.pinnedOrder = orderObj;
    arcTabsPluginInstance?.updateSettings({ pinnedOrder: orderObj });
  }
};

const LOCAL_STORAGE_KEY = "orca-arc-tabs-recent";

export interface RecentTab {
  id: number;
  title: string;
  icon: string;
}

export const arcTabsState = proxy({
  pinnedBlocks: [] as any[],
  pinnedOrder: {} as Record<string, number[]>,
  pinnedDisplayMode: "grid" as "grid" | "list",
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

export const addRecentBlock = (idNum: number, title: string, icon: string) => {
  const existingIdx = arcTabsState.recentlyVisited.findIndex(
    (item) => item.id === idNum,
  );
  if (existingIdx !== -1) {
    let changed = false;

    if (arcTabsState.recentlyVisited[existingIdx].title !== title && title) {
      const newTitleIsGeneric = title.startsWith("Block ");
      const oldTitleIsGeneric =
        arcTabsState.recentlyVisited[existingIdx].title.startsWith("Block ") ||
        !arcTabsState.recentlyVisited[existingIdx].title;

      if (!(newTitleIsGeneric && !oldTitleIsGeneric)) {
        arcTabsState.recentlyVisited[existingIdx].title = title;
        changed = true;
      }
    }

    if (arcTabsState.recentlyVisited[existingIdx].icon !== icon && icon) {
      arcTabsState.recentlyVisited[existingIdx].icon = icon;
      changed = true;
    }

    if (changed) {
      try {
        localStorage.setItem(
          LOCAL_STORAGE_KEY,
          JSON.stringify(arcTabsState.recentlyVisited),
        );
      } catch (e) {
        console.error(e);
      }
    }
    return;
  }

  const list = [...arcTabsState.recentlyVisited];
  list.unshift({
    id: idNum,
    title: title || `Block ${idNum}`,
    icon: icon || "",
  });
  const trimmed = list.slice(0, 15);
  arcTabsState.recentlyVisited = trimmed;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.error(e);
  }
};

export const removeRecentBlock = (idNum: number) => {
  const list = arcTabsState.recentlyVisited.filter((item) => item.id !== idNum);
  arcTabsState.recentlyVisited = list;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.error(e);
  }
};

export const unpinBlock = async (idNum: number) => {
  arcTabsState.pinnedBlocks = arcTabsState.pinnedBlocks.filter(
    (b) => b.id !== idNum,
  );

  const settings = arcTabsPluginInstance?.getSettings() || {};
  const orderObj = { ...(arcTabsState.pinnedOrder || settings.pinnedOrder || {}) };
  const pinTagName = settings.pinTagName || "ArcTab";

  for (const space of Object.keys(orderObj)) {
    const arr = [...orderObj[space]];
    const idx = arr.indexOf(idNum);
    if (idx !== -1) {
      arr.splice(idx, 1);
      orderObj[space] = arr;
    }
  }
  arcTabsState.pinnedOrder = orderObj;
  await arcTabsPluginInstance.updateSettings({ pinnedOrder: orderObj });

  try {
    const mainPanelId = findMainPanelId(orca.state.panels);
    if (!mainPanelId) return;

    orca.nav.goTo("block", { blockId: idNum }, mainPanelId);
    orca.nav.switchFocusTo(mainPanelId);
    await new Promise((r) => setTimeout(r, 500));

    await orca.commands.invokeEditorCommand(
      "core.editor.removeTag",
      null,
      idNum,
      pinTagName,
    );
  } catch (e) {
    console.error("Failed to remove pin tag", e);
  }
};

export const pinBlock = async (idNum: number, spaceId: string) => {
  const settings = arcTabsPluginInstance?.getSettings() || {};
  const pinTagName = settings.pinTagName || "ArcTab";

  // Optimistic UI: update order + blocks together atomically
  const block = orca.state.blocks[idNum];
  const optimisticBlock = block
    ? {
        id: idNum,
        text: block.text || "",
        properties: block.properties
          ? JSON.parse(JSON.stringify(block.properties))
          : [],
        refs: block.refs ? JSON.parse(JSON.stringify(block.refs)) : [],
      }
    : {
        id: idNum,
        text: `Block ${idNum}`,
        properties: [],
        refs: [],
      };

  const orderObj = {
    ...(arcTabsState.pinnedOrder || settings.pinnedOrder || {}),
  };
  const orderArray = [...(orderObj[spaceId] || [])];
  if (!orderArray.includes(idNum)) {
    orderArray.unshift(idNum);
    orderObj[spaceId] = orderArray;
  }

  const nextPinnedBlocks = [...arcTabsState.pinnedBlocks];
  if (!nextPinnedBlocks.some((b) => b.id === idNum)) {
    nextPinnedBlocks.push(optimisticBlock);
  }

  arcTabsState.pinnedOrder = orderObj;
  arcTabsState.pinnedBlocks = nextPinnedBlocks;
  arcTabsPluginInstance?.updateSettings({ pinnedOrder: orderObj });

  try {
    const mainPanelId = findMainPanelId(orca.state.panels);
    if (!mainPanelId) return;

    orca.nav.goTo("block", { blockId: idNum }, mainPanelId);
    orca.nav.switchFocusTo(mainPanelId);
    await new Promise((r) => setTimeout(r, 500));

    await DataImporter.applyTag(idNum, {
      name: pinTagName,
      properties: [
        {
          name: "Space",
          type: 3,
          value: [spaceId],
          typeArgs: { subType: "multi", choices: [spaceId] },
        },
      ],
    });
  } catch (err: any) {
    console.error("Pin failed", err);
    revertOptimisticPin(idNum, spaceId);
  }
};


