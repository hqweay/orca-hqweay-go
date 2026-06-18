import { DataImporter } from "@/libs/DataImporter";
import { arcTabsPluginInstance } from "../index";

export const pinBlock = async (blockId: string | number, spaceId: string) => {
  try {
    const idNum = Number(blockId);
    
    // First try DataImporter directly (works if block is already active)
    await DataImporter.applyTag(idNum, {
      name: "ArcTab",
      properties: [
        {
          name: "Space",
          type: 3,
          value: [spaceId],
          typeArgs: { subType: "multi" }
        }
      ]
    });

    // Check if it worked
    let pinned = await orca.invokeBackend("get-blocks-with-tags", ["ArcTab"]);
    let isPinned = pinned.some((b: any) => b.id === idNum);

    if (!isPinned) {
      console.log("Background pin failed, using Nav fallback...");
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
          name: "ArcTab",
          properties: [
            {
              name: "Space",
              type: 3,
              value: [spaceId],
              typeArgs: { subType: "multi" }
            }
          ]
        });
        
        orca.nav.close(tempPanelId);
        
        // Clean up CSS
        const cleanupStyle = document.getElementById(`hide-temp-panel-${tempPanelId}`);
        if (cleanupStyle) cleanupStyle.remove();
        orca.nav.switchFocusTo(activePanelId);
      }
    }
    
    // Also add to pinnedOrder in Settings to ensure it sorts correctly
    const settings = arcTabsPluginInstance?.getSettings() || {};
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
  return await orca.invokeBackend("get-blocks-with-tags", ["ArcTab"]);
};
