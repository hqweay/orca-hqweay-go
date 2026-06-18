import { DataImporter } from "@/libs/DataImporter";
import { arcTabsPluginInstance } from "../index";
import { proxy } from "valtio";

export const activePinningBlocks = new Set<number>();

export const arcTabsState = proxy({
  unpinningBlocks: [] as number[]
});

export const unpinBlock = async (blockId: string | number) => {
  const idNum = Number(blockId);
  
  // Optimistic UI update: instantly hide from UI
  if (!arcTabsState.unpinningBlocks.includes(idNum)) {
    arcTabsState.unpinningBlocks.push(idNum);
  }
  
  const settings = arcTabsPluginInstance?.getSettings() || {};
  const orderObj = settings.pinnedOrder || {};
  const pinTagName = settings.pinTagName || "ArcTab";
  
  let changed = false;
  for (const space of Object.keys(orderObj)) {
    const arr = orderObj[space];
    const idx = arr.indexOf(idNum);
    if (idx !== -1) {
      arr.splice(idx, 1);
      changed = true;
    }
  }
  
  if (changed) {
    await arcTabsPluginInstance.updateSettings({ pinnedOrder: orderObj });
  }
  
  try {
    await orca.commands.invokeEditorCommand(
      "core.editor.removeTag",
      null,
      idNum,
      pinTagName
    );

    // Wait a moment for backend indexing before verifying
    await new Promise(r => setTimeout(r, 200));

    // Check if it worked
    let pinned = await orca.invokeBackend("get-blocks-with-tags", [pinTagName]);
    let isPinned = pinned.some((b: any) => Number(b.id) === idNum);

    if (isPinned) {
      console.log("Background unpin failed, using Nav fallback...");
      activePinningBlocks.add(idNum);
      const activePanelId = orca.state.activePanel;
      
      const tempPanelId = orca.nav.addTo(activePanelId, "right", {
        view: "block",
        viewArgs: { blockId: idNum },
        viewState: {}
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
      await new Promise(r => setTimeout(r, 500));
      
      await orca.commands.invokeEditorCommand(
        "core.editor.removeTag",
        null,
        idNum,
        pinTagName
      );
      
      if (tempPanelId) {
        orca.nav.close(tempPanelId);
        const style = document.getElementById(`hide-temp-panel-${tempPanelId}`);
        if (style) style.remove();
        orca.nav.switchFocusTo(activePanelId);
        
        // Wait a tick before removing from pinning blocks to let UI stabilize
        setTimeout(() => activePinningBlocks.delete(idNum), 100);
      }
    }

    // Wait a short delay to allow backend to index the tag removal before UI reloads
    await new Promise(r => setTimeout(r, 300));
  } catch (e) {
    console.error("Failed to remove pin tag", e);
  } finally {
    // Keep it in unpinningBlocks for a bit longer to cover any extreme backend delays
    setTimeout(() => {
      arcTabsState.unpinningBlocks = arcTabsState.unpinningBlocks.filter(id => id !== idNum);
    }, 5000);
  }
};

export const renamePinnedBlock = async (blockId: string | number, newName: string) => {
  const idNum = Number(blockId);
  const settings = arcTabsPluginInstance?.getSettings() || {};
  const pinTagName = settings.pinTagName || "ArcTab";

  // Check if it already has the tag
  let pinned = await orca.invokeBackend("get-blocks-with-tags", [pinTagName]);
  let isPinned = pinned.some((b: any) => Number(b.id) === idNum);

  if (!isPinned) {
    // Need to tag it first, but typically rename happens on pinned tabs
    await pinBlock(idNum, "default");
  }

  // Update tag schema property
  await DataImporter.applyTag(idNum, {
    name: pinTagName,
    properties: [
      {
        name: "displayName",
        type: 0, // PropType.Text
        value: newName
      }
    ]
  });
};

export const pinBlock = async (blockId: string | number, spaceId: string) => {
  try {
    const idNum = Number(blockId);
    
    const settings = arcTabsPluginInstance?.getSettings() || {};
    const pinTagName = settings.pinTagName || "ArcTab";

    // First try DataImporter directly (works if block is already active)
    await DataImporter.applyTag(idNum, {
      name: pinTagName,
      properties: [
        {
          name: "Space",
          type: 3,
          value: [spaceId],
          typeArgs: { subType: "multi", choices: [spaceId] }
        }
      ]
    });

    // Wait a moment for backend indexing before verifying
    await new Promise(r => setTimeout(r, 200));

    // Check if it worked
    let pinned = await orca.invokeBackend("get-blocks-with-tags", [pinTagName]);
    let isPinned = pinned.some((b: any) => Number(b.id) === idNum);

    if (!isPinned) {
      console.log("Background pin failed, using Nav fallback...");
      activePinningBlocks.add(idNum);
      const activePanelId = orca.state.activePanel;
      
      const tempPanelId = orca.nav.addTo(activePanelId, "right", {
        view: "block",
        viewArgs: { blockId: idNum },
        viewState: {}
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
        await new Promise(resolve => setTimeout(resolve, 500));
        
        await DataImporter.applyTag(idNum, {
          name: pinTagName,
          properties: [
            {
              name: "Space",
              type: 3,
              value: [spaceId],
              typeArgs: { subType: "multi", choices: [spaceId] }
            }
          ]
        });
        
        orca.nav.close(tempPanelId);
        
        // Clean up CSS
        const cleanupStyle = document.getElementById(`hide-temp-panel-${tempPanelId}`);
        if (cleanupStyle) cleanupStyle.remove();
        orca.nav.switchFocusTo(activePanelId);
        
        // Wait a tick before removing from pinning blocks to let UI stabilize
        setTimeout(() => activePinningBlocks.delete(idNum), 100);
      }
    }
    
    // Also add to pinnedOrder in Settings to ensure it sorts correctly
    // settings is already declared at the top of the function
    const orderObj = settings.pinnedOrder || {};
    const orderArray = orderObj[spaceId] || [];
    
    if (!orderArray.includes(idNum)) {
      orderArray.unshift(idNum); // push to top
      orderObj[spaceId] = orderArray;
      arcTabsPluginInstance?.updateSettings({ pinnedOrder: orderObj });
    }
    
    console.log("Pinned successfully using Tag approach");
  } catch (err: any) {
    console.error("Pin failed", err);
  }
};

export const fetchPinnedBlocks = async (): Promise<any[]> => {
  const settings = arcTabsPluginInstance?.getSettings() || {};
  const pinTagName = settings.pinTagName || "ArcTab";
  return await orca.invokeBackend("get-blocks-with-tags", [pinTagName]);
};
