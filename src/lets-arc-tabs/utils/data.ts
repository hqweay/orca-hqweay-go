import { DataImporter } from "@/libs/DataImporter";
import { arcTabsPluginInstance } from "../index";
import { proxy } from "valtio";
import { PropType } from "@/libs/consts";
import {
  findMainPanelId,
  findArcTabsPanelId,
  findArcTabsPanelWidth,
} from "./nav";

export const activePinningBlocks = new Set<number>();

/** Blocks optimistically unpinned; filtered out until backend catches up. */
export const optimisticUnpinnedIds = new Set<number>();

const getPinnedOrderFromSettings = (): Record<string, number[]> => {
  const settings = arcTabsPluginInstance?.getSettings() || {};
  return (settings.pinnedOrder || {}) as Record<string, number[]>;
};

const getAllOrderedPinIds = (orderObj: Record<string, number[]>): Set<number> =>
  new Set(Object.values(orderObj).flat());

/** Merge backend fetch with optimistic pin/unpin state to avoid UI flicker. */
export const syncPinnedBlocksWithBackend = async () => {
  const backendBlocks = await fetchPinnedBlocks();
  const orderObj =
    Object.keys(arcTabsState.pinnedOrder).length > 0
      ? arcTabsState.pinnedOrder
      : getPinnedOrderFromSettings();
  const orderIds = getAllOrderedPinIds(orderObj);
  const backendIds = new Set(backendBlocks.map((b) => b.id));

  const pendingOptimisticPins = arcTabsState.pinnedBlocks.filter(
    (b) =>
      !optimisticUnpinnedIds.has(b.id) &&
      orderIds.has(b.id) &&
      !backendIds.has(b.id),
  );

  const byId = new Map<number, any>();
  for (const block of backendBlocks) {
    if (!optimisticUnpinnedIds.has(block.id)) {
      byId.set(block.id, block);
    }
  }
  for (const block of pendingOptimisticPins) {
    if (!byId.has(block.id)) {
      byId.set(block.id, block);
    }
  }

  arcTabsState.pinnedBlocks = Array.from(byId.values());
};

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
  // If already in list, DO NOT change its position (keep it stable), but update title/icon if changed
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

      // Avoid overwriting a real title with a generic "Block x" title
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
  optimisticUnpinnedIds.add(idNum);

  // Optimistic UI update: instantly hide from UI
  arcTabsState.pinnedBlocks = arcTabsState.pinnedBlocks.filter(
    (b) => b.id !== idNum,
  );

  const settings = arcTabsPluginInstance?.getSettings() || {};
  const orderObj = { ...(arcTabsState.pinnedOrder || settings.pinnedOrder || {}) };
  const pinTagName = settings.pinTagName || "ArcTab";

  let changed = false;
  for (const space of Object.keys(orderObj)) {
    const arr = [...orderObj[space]];
    const idx = arr.indexOf(idNum);
    if (idx !== -1) {
      arr.splice(idx, 1);
      orderObj[space] = arr;
      changed = true;
    }
  }

  if (changed) {
    arcTabsState.pinnedOrder = orderObj;
    await arcTabsPluginInstance.updateSettings({ pinnedOrder: orderObj });
  }

  try {
    // await orca.commands.invokeEditorCommand(
    //   "core.editor.removeTag",
    //   null,
    //   idNum,
    //   pinTagName
    // );

    // // Wait a moment for backend indexing before verifying
    // await new Promise(r => setTimeout(r, 200));

    // Check if it worked
    let pinned = await fetchPinnedBlocks();
    let isPinned = pinned.some((b: any) => b.id === idNum);

    if (isPinned) {
      console.log("Background unpin failed, using Nav fallback...");
      activePinningBlocks.add(idNum);
      const activePanelId = orca.state.activePanel;

      const originalWidth = findArcTabsPanelWidth(orca.state.panels) || 250;

      const arcTabsPanelId = findArcTabsPanelId(orca.state.panels);
      const targetPanelId = arcTabsPanelId || activePanelId;

      const tempPanelId = orca.nav.addTo(targetPanelId, "top", {
        view: "block",
        viewArgs: { blockId: idNum },
        viewState: {},
      });

      if (tempPanelId) {
        // Inject CSS to completely hide the temporary panel and prevent layout shift
        const style = document.createElement("style");
        style.id = `hide-temp-panel-${tempPanelId}`;
        style.innerHTML = `
          .orca-panel[data-panel-id="${tempPanelId}"],
          div[data-panel-id="${tempPanelId}"] {
            position: absolute !important;
            opacity: 0 !important;
            width: 1px !important;
            height: 1px !important;
            pointer-events: none !important;
            z-index: -999 !important;
          }
        `;
        document.head.appendChild(style);

        // Switch focus to the temp panel so the editor becomes active
        orca.nav.switchFocusTo(tempPanelId);
      }

      // Wait a moment for block to mount
      await new Promise((r) => setTimeout(r, 500));

      await orca.commands.invokeEditorCommand(
        "core.editor.removeTag",
        null,
        idNum,
        pinTagName,
      );

      if (tempPanelId) {
        orca.nav.close(tempPanelId);
        const style = document.getElementById(`hide-temp-panel-${tempPanelId}`);
        if (style) style.remove();
        orca.nav.switchFocusTo(activePanelId);

        // Restore sidebar width
        const arcTabsPanelId = findArcTabsPanelId(orca.state.panels);
        if (arcTabsPanelId) {
          orca.nav.changeSizes(arcTabsPanelId, [
            originalWidth,
            window.innerWidth - originalWidth,
          ]);
        }

        // Wait a tick before removing from pinning blocks to let UI stabilize
        setTimeout(() => activePinningBlocks.delete(idNum), 100);
      }
    }

    // Wait a short delay to allow backend to index the tag removal before UI reloads
    await new Promise((r) => setTimeout(r, 300));
  } catch (e) {
    console.error("Failed to remove pin tag", e);
  } finally {
    await syncPinnedBlocksWithBackend();
    optimisticUnpinnedIds.delete(idNum);
  }
};

export const pinBlock = async (idNum: number, spaceId: string) => {
  const settings = arcTabsPluginInstance?.getSettings() || {};
  const pinTagName = settings.pinTagName || "ArcTab";

  // --- Optimistic UI logic: immediately push to pinnedBlocks & settings pinnedOrder ---
  try {
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

    if (!arcTabsState.pinnedBlocks.some((b) => b.id === idNum)) {
      arcTabsState.pinnedBlocks.push(optimisticBlock);
    }

    const orderObj = {
      ...(arcTabsState.pinnedOrder || settings.pinnedOrder || {}),
    };
    const orderArray = [...(orderObj[spaceId] || [])];
    if (!orderArray.includes(idNum)) {
      orderArray.unshift(idNum); // push to top
      orderObj[spaceId] = orderArray;
      arcTabsState.pinnedOrder = orderObj;
      arcTabsPluginInstance?.updateSettings({ pinnedOrder: orderObj });
    }
  } catch (e) {
    console.error("Optimistic pin update failed", e);
  }

  try {
    // First try DataImporter directly (works if block is already active)
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

    // Wait a moment for backend indexing before verifying
    await new Promise((r) => setTimeout(r, 200));

    // Check if it worked
    let pinned = await fetchPinnedBlocks();
    let isPinned = pinned.some((b: any) => b.id === idNum);

    if (!isPinned) {
      console.log("Background pin failed, using Nav fallback...");
      activePinningBlocks.add(idNum);
      const activePanelId = orca.state.activePanel;

      const originalWidth = findArcTabsPanelWidth(orca.state.panels) || 250;

      const arcTabsPanelId = findArcTabsPanelId(orca.state.panels);
      const targetPanelId = arcTabsPanelId || activePanelId;

      const tempPanelId = orca.nav.addTo(targetPanelId, "top", {
        view: "block",
        viewArgs: { blockId: idNum },
        viewState: {},
      });

      if (tempPanelId) {
        // Inject CSS to completely hide the temporary panel and prevent layout shift
        const style = document.createElement("style");
        style.id = `hide-temp-panel-${tempPanelId}`;
        style.innerHTML = `
          .orca-panel[data-panel-id="${tempPanelId}"],
          div[data-panel-id="${tempPanelId}"] {
            position: absolute !important;
            opacity: 0 !important;
            width: 1px !important;
            height: 1px !important;
            pointer-events: none !important;
            z-index: -999 !important;
          }
        `;
        document.head.appendChild(style);

        // Switch focus to the temp panel so the editor becomes active
        orca.nav.switchFocusTo(tempPanelId);

        // Wait for rendering (increase to 500ms to be safe)
        await new Promise((resolve) => setTimeout(resolve, 500));

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

        orca.nav.close(tempPanelId);

        // Clean up CSS
        const cleanupStyle = document.getElementById(
          `hide-temp-panel-${tempPanelId}`,
        );
        if (cleanupStyle) cleanupStyle.remove();
        orca.nav.switchFocusTo(activePanelId);

        // Restore sidebar width
        const arcTabsPanelId = findArcTabsPanelId(orca.state.panels);
        if (arcTabsPanelId) {
          orca.nav.changeSizes(arcTabsPanelId, [
            originalWidth,
            window.innerWidth - originalWidth,
          ]);
        }

        // Wait a tick before removing from pinning blocks to let UI stabilize
        setTimeout(() => activePinningBlocks.delete(idNum), 100);
      }
    }

    console.log("Pinned successfully using Tag approach");
    await syncPinnedBlocksWithBackend();
  } catch (err: any) {
    console.error("Pin failed", err);
    revertOptimisticPin(idNum, spaceId);
  }
};

export const fetchPinnedBlocks = async (): Promise<any[]> => {
  const settings = arcTabsPluginInstance?.getSettings() || {};
  const pinTagName = settings.pinTagName || "ArcTab";
  const blocks =
    (await orca.invokeBackend("get-blocks-with-tags", [pinTagName])) || [];
  return blocks.map((b: any) => ({
    ...b,
    id: Number(b.id),
  }));
};
