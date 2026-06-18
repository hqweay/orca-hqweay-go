import { DataImporter } from "@/libs/DataImporter";
import { arcTabsPluginInstance } from "../index";
import { arcTabsState } from "./data";
import { findMainPanelId } from "./nav";

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
  
  // Check refs for tag reference with Space property
  const tagRef = block.refs?.find((r: any) => r.name === pinTagName);
  if (tagRef?.data) {
    const prop = tagRef.data.find((p: any) => p.name === "Space");
    if (prop?.value?.length > 0) return prop.value;
  }
  
  // Fallback to block properties
  const prop = block.properties?.find((p: any) => p.name === "Space");
  return prop?.value || [];
};

export const loadPinnedBlocks = async (space?: string) => {
  const pinTagName = getPinTagName();
  
  if (space) {
    const resultIds = (await orca.invokeBackend("query", {
      q: {
        kind: 100,
        conditions: [
          {
            kind: 4,
            name: pinTagName,
            properties: [{ name: "Space", op: 1, value: space }],
            selfOnly: true,
          },
        ],
      },
    })) as number[];
    
    if (resultIds && resultIds.length > 0) {
      const blocks = (await orca.invokeBackend("get-blocks", resultIds)) || [];
      arcTabsState.pinnedBlocks = blocks.map((b: any) => ({
        ...b,
        id: Number(b.id),
      }));
    } else {
      arcTabsState.pinnedBlocks = [];
    }
  } else {
    const blocks =
      (await orca.invokeBackend("get-blocks-with-tags", [pinTagName])) || [];
    arcTabsState.pinnedBlocks = blocks.map((b: any) => ({
      ...b,
      id: Number(b.id),
    }));
  }
};

export const pinBlock = async (idNum: number, spaceId: string) => {
  const pinTagName = getPinTagName();

  const block = orca.state.blocks[idNum];
  const existing = arcTabsState.pinnedBlocks.find((b) => b.id === idNum);

  if (existing) {
    const currentSpaces = getSpaceFromBlock(existing);
    const newSpaces = [...new Set([...currentSpaces, spaceId])];
    
    const tagRef = existing.refs?.find((r: any) => r.name === pinTagName);
    
    if (tagRef?.data) {
      const spaceProp = tagRef.data.find((p: any) => p.name === "Space");
      if (spaceProp) {
        spaceProp.value = newSpaces;
      } else {
        tagRef.data.push(buildSpaceProperty(newSpaces));
      }
    } else {
      existing.properties = existing.properties || [];
      existing.properties.push(buildSpaceProperty(newSpaces));
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

    optimisticBlock.properties.push(buildSpaceProperty([spaceId]));
    arcTabsState.pinnedBlocks = [...arcTabsState.pinnedBlocks, optimisticBlock];
  }

  try {
    const mainPanelId = findMainPanelId(orca.state.panels);
    if (!mainPanelId) return;

    orca.nav.goTo("block", { blockId: idNum }, mainPanelId);
    orca.nav.switchFocusTo(mainPanelId);
    await new Promise((r) => setTimeout(r, 500));

    const currentSpaces = existing ? getSpaceFromBlock(existing) : [];

    await DataImporter.applyTag(idNum, {
      name: pinTagName,
      properties: [buildSpaceProperty([...new Set([...currentSpaces, spaceId])])],
    });
  } catch (err) {
    console.error("Pin failed", err);
    revertPin(idNum, spaceId);
  }
};

export const unpinBlock = async (idNum: number, space?: string) => {
  const pinTagName = getPinTagName();
  const block = arcTabsState.pinnedBlocks.find((b) => b.id === idNum);

  if (space && block) {
    const currentSpaces = getSpaceFromBlock(block);
    const newSpaces = currentSpaces.filter((s: string) => s !== space);
    
    if (newSpaces.length > 0) {
      const tagRef = block.refs?.find((r: any) => r.name === pinTagName);
      
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
    const mainPanelId = findMainPanelId(orca.state.panels);
    if (!mainPanelId) return;

    orca.nav.goTo("block", { blockId: idNum }, mainPanelId);
    orca.nav.switchFocusTo(mainPanelId);
    await new Promise((r) => setTimeout(r, 500));

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

const revertPin = (idNum: number, _spaceId: string) => {
  arcTabsState.pinnedBlocks = arcTabsState.pinnedBlocks.filter(
    (b) => b.id !== idNum
  );
};
