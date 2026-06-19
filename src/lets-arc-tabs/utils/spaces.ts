import { arcTabsPluginInstance } from "../index";
import { arcTabsState } from "./data";
import { findMainPanelId } from "./nav";

const getSpaceProperty = (block: any): string[] => {
  const pinTagName = arcTabsPluginInstance?.getSettings()?.pinTagName || "ArcTab";
  
  // 1. Check refs[].data (loaded from backend)
  const tagRef = block.refs?.find((r: any) => r.alias === pinTagName);
  if (tagRef?.data) {
    const prop = tagRef.data.find((p: any) => p.name === "Space");
    if (prop?.value?.length > 0) return prop.value;
  }
  
  // 2. Check block.properties (optimistic update)
  const blockProp = block.properties?.find((p: any) => p.name === "Space");
  if (blockProp?.value?.length > 0) return blockProp.value;
  
  return [];
};

export const loadSpacesFromTag = async (): Promise<string[]> => {
  const settings = arcTabsPluginInstance?.getSettings() || {};
  const pinTagName = settings.pinTagName || "ArcTab";
  
  const tagBlock = (await orca.invokeBackend(
    "get-block-by-alias",
    pinTagName,
  )) as any;
  
  if (!tagBlock) return [];
  
  const spaceProp = tagBlock.properties?.find((p: any) => p.name === "Space");
  return spaceProp?.typeArgs?.choices || [];
};

export const getSpaces = (): string[] => {
  const spaces = new Set<string>();
  
  for (const block of arcTabsState.pinnedBlocks) {
    getSpaceProperty(block).forEach((s: string) => spaces.add(s));
  }
  
  if (arcTabsState.spaceChoices) {
    arcTabsState.spaceChoices.forEach((s: string) => spaces.add(s));
  }
  
  return Array.from(spaces).sort();
};

export const getBlocksInSpace = (space: string): any[] => {
  return arcTabsState.pinnedBlocks.filter((b) =>
    getSpaceProperty(b).includes(space)
  );
};


export const addSpaceChoice = async (spaceName: string) => {
  const settings = arcTabsPluginInstance?.getSettings() || {};
  const pinTagName = settings.pinTagName || "ArcTab";
  
  const tagBlock = (await orca.invokeBackend(
    "get-block-by-alias",
    pinTagName,
  )) as any;
  
  if (!tagBlock) return;
  
  const spaceProp = tagBlock.properties?.find((p: any) => p.name === "Space");
  const existingChoices = spaceProp?.typeArgs?.choices || [];
  
  if (existingChoices.includes(spaceName)) return;
  
  const newChoices = [...existingChoices, spaceName];
  
  try {
    const mainPanelId = findMainPanelId(orca.state.panels, orca.state.activePanel);
    if (!mainPanelId) return;
    
    orca.nav.goTo("block", { blockId: tagBlock.id }, mainPanelId);
    orca.nav.switchFocusTo(mainPanelId);
    await new Promise((r) => setTimeout(r, 500));
    
    await orca.commands.invokeEditorCommand(
      "core.editor.setProperties",
      null,
      [tagBlock.id],
      [{
        name: "Space",
        type: 6,
        typeArgs: {
          subType: "multi",
          choices: newChoices,
        },
      }],
    );
    
    arcTabsState.spaceChoices = newChoices;
  } catch (e) {
    console.error("Failed to add space choice", e);
  }
};
