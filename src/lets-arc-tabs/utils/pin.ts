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

export const loadPinnedBlocks = async () => {
  const blocks =
    (await orca.invokeBackend("get-blocks-with-tags", [getPinTagName()])) || [];
  arcTabsState.pinnedBlocks = blocks.map((b: any) => ({
    ...b,
    id: Number(b.id),
  }));
};

export const pinBlock = async (idNum: number, spaceId: string) => {
  const pinTagName = getPinTagName();

  const block = orca.state.blocks[idNum];
  const existing = arcTabsState.pinnedBlocks.find((b) => b.id === idNum);

  if (existing) {
    const spaces = new Set([
      ...((existing.properties?.find((p: any) => p.name === "Space")?.value) || []),
      spaceId,
    ]);
    const spaceProp = existing.properties?.find((p: any) => p.name === "Space");
    if (spaceProp) {
      spaceProp.value = Array.from(spaces);
    } else {
      existing.properties = existing.properties || [];
      existing.properties.push(buildSpaceProperty(Array.from(spaces)));
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

    const currentSpaces = existing
      ? existing.properties?.find((p: any) => p.name === "Space")?.value || []
      : [];

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
    const spaceProp = block.properties?.find((p: any) => p.name === "Space");
    if (spaceProp) {
      spaceProp.value = spaceProp.value.filter((s: string) => s !== space);
    }
    if ((spaceProp?.value?.length || 0) > 0) {
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
