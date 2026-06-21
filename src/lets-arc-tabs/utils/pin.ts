import { DataImporter } from "@/libs/DataImporter";
import { arcTabsPluginInstance } from "../index";
import { arcTabsState } from "./data";
import { findMainPanelId } from "./nav";
import { ensureBlockInState } from "../../libs/utils";

const getPinTagName = () => {
  const settings = arcTabsPluginInstance?.getSettings() || {};
  return settings.pinTagName || "ArcTab";
};

const buildSpaceProperty = (spaces: string[]) => ({
  name: "Space",
  type: 6,
  value: spaces,
  typeArgs: { subType: "multi", choices: spaces },
});

const getSpaceFromBlock = (block: any): string[] => {
  const pinTagName = getPinTagName();
  
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

export const loadPinnedBlocks = async () => {
  const pinTagName = getPinTagName();
  const blocks =
    (await orca.invokeBackend("get-blocks-with-tags", [pinTagName])) || [];
  arcTabsState.pinnedBlocks = blocks.map((b: any) => ({
    ...b,
    id: Number(b.id),
  }));
};

export const pinBlock = async (idNum: number, spaceId: string) => {
  const pinTagName = getPinTagName();

  if (!idNum || idNum <= 0) {
    return;
  }

  const block = orca.state.blocks[idNum];
  const existingInState = arcTabsState.pinnedBlocks.find((b) => b.id === idNum);

  const sourceBlock = existingInState || block;
  const currentSpaces = sourceBlock ? getSpaceFromBlock(sourceBlock) : [];
  const allSpaces = [...new Set([...currentSpaces, spaceId])];

  if (existingInState) {
    const tagRef = existingInState.refs?.find((r: any) => r.alias === pinTagName);
    if (tagRef?.data) {
      const spaceProp = tagRef.data.find((p: any) => p.name === "Space");
      if (spaceProp) {
        spaceProp.value = allSpaces;
      } else {
        tagRef.data.push(buildSpaceProperty(allSpaces));
      }
    } else {
      existingInState.properties = existingInState.properties || [];
      existingInState.properties.push(buildSpaceProperty(allSpaces));
    }
    arcTabsState.pinnedBlocks = [...arcTabsState.pinnedBlocks];
  } else {
    const optimisticBlock = block
      ? {
          id: idNum,
          text: block.text || "",
          properties: block.properties
            ? JSON.parse(JSON.stringify(block.properties))
            : [],
          refs: block.refs ? JSON.parse(JSON.stringify(block.refs)) : [],
        }
      : { id: idNum, text: `Block ${idNum}`, properties: [], refs: [] };

    optimisticBlock.properties.push(buildSpaceProperty(allSpaces));
    arcTabsState.pinnedBlocks = [...arcTabsState.pinnedBlocks, optimisticBlock];
  }

  try {
    let mainPanelId = findMainPanelId(orca.state.panels, orca.state.activePanel);
    
    if (mainPanelId) {
      orca.nav.switchFocusTo(mainPanelId);
    } else {
      // Fallback: No editor exists, force open one so editor commands can run
      orca.nav.goTo("block", { blockId: idNum });
      await new Promise((r) => setTimeout(r, 500));
    }

    await ensureBlockInState(idNum);

    await DataImporter.applyTag(idNum, {
      name: pinTagName,
      properties: [buildSpaceProperty(allSpaces)],
    });
  } catch (err) {
    console.error("[ArcTabs] Pin failed:", err);
    revertPin(idNum);
  }
};

export const unpinBlock = async (idNum: number, space?: string) => {
  const pinTagName = getPinTagName();
  const block = arcTabsState.pinnedBlocks.find((b) => b.id === idNum);

  if (space && block) {
    const currentSpaces = getSpaceFromBlock(block);
    const newSpaces = currentSpaces.filter((s: string) => s !== space);
    
    if (newSpaces.length > 0) {
      const tagRef = block.refs?.find((r: any) => r.alias === pinTagName);
      
      if (tagRef?.data) {
        const spaceProp = tagRef.data.find((p: any) => p.name === "Space");
        if (spaceProp) {
          spaceProp.value = newSpaces;
        }
      }
      arcTabsState.pinnedBlocks = [...arcTabsState.pinnedBlocks];
      return;
    }
  }

  arcTabsState.pinnedBlocks = arcTabsState.pinnedBlocks.filter(
    (b) => b.id !== idNum
  );

  try {
    let mainPanelId = findMainPanelId(orca.state.panels, orca.state.activePanel);
    
    if (mainPanelId) {
      orca.nav.switchFocusTo(mainPanelId);
    } else {
      // Fallback: No editor exists, force open one so editor commands can run
      orca.nav.goTo("block", { blockId: idNum });
      await new Promise((r) => setTimeout(r, 500));
    }

    await ensureBlockInState(idNum);

    await orca.commands.invokeEditorCommand(
      "core.editor.removeTag",
      null,
      idNum,
      pinTagName
    );
  } catch (e) {
    console.error("Failed to remove pin tag", e);
  }
};

const revertPin = (idNum: number) => {
  arcTabsState.pinnedBlocks = arcTabsState.pinnedBlocks.filter(
    (b) => b.id !== idNum
  );
};
