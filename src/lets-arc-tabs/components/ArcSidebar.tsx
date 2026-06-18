import React, { useMemo, useState, useEffect } from "react";
import { useSnapshot } from "valtio";
import { t } from "@/libs/l10n";

import styles from "../styles.css?inline";
import {
  getActiveBlocks,
  findMainPanelId,
  getFocusedBlock,
} from "../utils/nav";
import {
  fetchPinnedBlocks,
  pinBlock,
  activePinningBlocks,
  arcTabsState,
  addRecentBlock,
} from "../utils/data";
import { TabItem } from "./TabItem";
import { arcTabsPluginInstance } from "../index";

const getBlockTitle = (block: any, id: string | number) => {
  if (!block) return `Block ${String(id).substring(0, 8)}`;
  
  // Try to get journal date if it's a journal block
  const reprProp = block.properties?.find((p: any) => p.name === "_repr");
  if (reprProp && reprProp.value?.type === "journal" && reprProp.value?.date) {
    const d = new Date(reprProp.value.date);
    if (!isNaN(d.getTime())) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }
  }
  
  if (block.aliases && block.aliases.length > 0) return block.aliases[0];
  if (block.text && block.text.trim().length > 0) {
    let text = block.text.trim();
    if (text.length > 20) {
      return text.substring(0, 20) + "...";
    }
    return text;
  }
  return `Block ${String(id).substring(0, 8)}`;
};

const getBlockIcon = (block: any) => {
  if (!block) return '📄';
  
  // 1. Check custom icon property
  const iconProp = block.properties?.find((p: any) => p.name === "_icon");
  if (iconProp && iconProp.value) {
    return iconProp.value;
  }
  
  // 2. Check if journal block
  const reprProp = block.properties?.find((p: any) => p.name === "_repr");
  if (reprProp && reprProp.value?.type === "journal") {
    return '📅';
  }
  
  return '📄';
};

const StyleInjector = () => (
  <style dangerouslySetInnerHTML={{ __html: styles }} />
);

export const ArcSidebar: React.FC = () => {
  const state = useSnapshot(orca.state);
  const localArcTabsState = useSnapshot(arcTabsState);

  const [activeSpace, setActiveSpace] = useState("default");
  const [pinnedBlocks, setPinnedBlocks] = useState<any[]>([]);

  // Function to reload pinned blocks
  const reloadPinnedBlocks = async () => {
    const blocks = await fetchPinnedBlocks();
    setPinnedBlocks(blocks);
  };

  useEffect(() => {
    reloadPinnedBlocks();
  }, [activeSpace]); // reload if space changes (though we fetch all tags, we filter below)

  const activeBlockIds = useMemo(() => {
    return getActiveBlocks(state.panels)
      .map(Number)
      .filter((id) => {
        return !activePinningBlocks.has(id);
      });
  }, [state.panels]);
  // Filter and SORT pinned blocks for the active space
  const currentSpacePinnedBlocks = useMemo(() => {
    const settings = arcTabsPluginInstance?.getSettings() || {};
    const orderObj = settings.pinnedOrder || {};
    const orderArray = (orderObj[activeSpace] || []) as number[];

    // Find blocks that have #ArcTab but haven't been assigned to any space yet (e.g. manually typed)
    const allAssignedIds = Object.values(orderObj).flat() as number[];
    const unassignedBlocks = pinnedBlocks.filter(
      (b) => !allAssignedIds.includes(b.id),
    );

    // We render blocks assigned to this space PLUS any new unassigned ones
    let currentBlocks = pinnedBlocks.filter(
      (b) => orderArray.includes(b.id) || unassignedBlocks.includes(b),
    );

    // Optimistic UI update: Filter out blocks that are currently being unpinned
    currentBlocks = currentBlocks.filter(
      (b) => !localArcTabsState.unpinningBlocks.includes(b.id),
    );

    return currentBlocks.sort((a, b) => {
      const indexA = orderArray.indexOf(a.id);
      const indexB = orderArray.indexOf(b.id);
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1; // unassigned go to bottom
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }, [pinnedBlocks, activeSpace, localArcTabsState.unpinningBlocks]);

  // Synchronize all open panel blocks into the recentlyVisited list stably
  useEffect(() => {
    let changed = false;
    const list = [...arcTabsState.recentlyVisited];
    activeBlockIds.forEach((id) => {
      if (!list.some((item) => item.id === id)) {
        const block = state.blocks[id];
        const title = getBlockTitle(block, id);
        const icon = getBlockIcon(block);
        list.unshift({ id, title, icon });
        changed = true;
      }
    });
    if (changed) {
      arcTabsState.recentlyVisited = list.slice(0, 15);
      try {
        localStorage.setItem(
          "orca-arc-tabs-recent",
          JSON.stringify(arcTabsState.recentlyVisited),
        );
      } catch (e) {
        console.error(e);
      }
    }
  }, [activeBlockIds]);

  const todayTabs = useMemo(() => {
    const pinnedIds = currentSpacePinnedBlocks.map((b) => b.id);
    return localArcTabsState.recentlyVisited
      .filter(
        (item) =>
          !pinnedIds.includes(item.id) &&
          !localArcTabsState.unpinningBlocks.includes(item.id),
      )
      .slice(0, 15);
  }, [
    localArcTabsState.recentlyVisited,
    currentSpacePinnedBlocks,
    localArcTabsState.unpinningBlocks,
  ]);

  // Find currently focused block in the active panel
  const focusedBlock = useMemo(() => {
    return getFocusedBlock(state.panels, state.activePanel);
  }, [state.panels, state.activePanel]);

  const isBlockCached = !!(focusedBlock && state.blocks[focusedBlock]);

  // Track page visits
  useEffect(() => {
    if (focusedBlock && !activePinningBlocks.has(focusedBlock)) {
      const block = state.blocks[focusedBlock];
      const title = getBlockTitle(block, focusedBlock);
      const icon = getBlockIcon(block);
      addRecentBlock(focusedBlock, title, icon);
    }
  }, [focusedBlock, isBlockCached]);

  const getBlockDisplayName = (block: any) => {
    const settings = arcTabsPluginInstance?.getSettings() || {};
    const pinTagName = settings.pinTagName || "ArcTab";

    // Try to get from tag properties
    const tagRef = block.refs?.find(
      (r: any) =>
        r.type === 2 && (r.alias === pinTagName || r.name === pinTagName),
    );
    const displayName =
      tagRef?.data?.find((p: any) => p.name === "displayName")?.value ||
      block.properties?.find((p: any) => p.name === "displayName")?.value;

    if (displayName) {
      return displayName;
    }

    // Try to get journal date if it's a journal block
    const reprProp = block.properties?.find((p: any) => p.name === "_repr");
    if (reprProp && reprProp.value?.type === "journal" && reprProp.value?.date) {
      const d = new Date(reprProp.value.date);
      if (!isNaN(d.getTime())) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
      }
    }

    // Fallback to text truncation
    let text = block.text || block.content || "";
    if (text) {
      if (text.length > 20) {
        return text.substring(0, 20) + "...";
      }
      return text;
    }

    return `Block ${block.id}`;
  };

  // Filter out pinned blocks from Today tabs
  const filteredTodayTabs = useMemo(() => {
    const pinnedIds = currentSpacePinnedBlocks.map((b) => b.id);
    return todayTabs.filter((tab) => !pinnedIds.includes(tab.id));
  }, [todayTabs, currentSpacePinnedBlocks]);

  const handleTabClick = (blockId: number) => {
    const mainPanelId = findMainPanelId(state.panels);
    if (mainPanelId) {
      orca.nav.goTo("block", { blockId }, mainPanelId);
    } else {
      const sidebarPanelId = orca.state.activePanel;
      orca.nav.addTo(sidebarPanelId, "right", {
        view: "block",
        viewArgs: { blockId },
        viewState: {},
      });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Required to allow drop
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    try {
      const types = Array.from(e.dataTransfer.types);
      console.log("Drop types: " + types.join(", "));

      const textData = e.dataTransfer.getData("text/plain");
      const jsonData = e.dataTransfer.getData("application/json");
      const orcaBlocks = e.dataTransfer.getData("application/x-orca-blocks");

      console.log(
        "text: " +
          (textData ? "yes" : "no") +
          ", json: " +
          (jsonData ? "yes" : "no") +
          ", orca: " +
          (orcaBlocks ? "yes" : "no"),
      );

      const data = jsonData || orcaBlocks || textData;
      if (data) {
        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch (err) {
          parsed = data; // fallback to string
        }

        let ids: string[] = [];

        // Handle various potential formats for Orca block drag payload
        if (typeof parsed === "object" && parsed !== null) {
          if (parsed.id) ids.push(parsed.id);
          else if (Array.isArray(parsed.blockIds)) ids = parsed.blockIds;
          else if (Array.isArray(parsed) && parsed[0]?.id)
            ids = parsed.map((b: any) => b.id);
        } else if (typeof parsed === "string") {
          ids.push(parsed);
        }

        console.log("Parsed ids: " + ids.join(", "));

        for (const id of ids) {
          const numId = Number(id);
          if (!isNaN(numId)) {
            await pinBlock(numId, activeSpace);
          }
        }
        if (ids.length > 0) reloadPinnedBlocks();
      }
    } catch (err) {
      console.error("Failed to parse dropped block data", err);
    }
  };

  return (
    <div className="arc-sidebar-container">
      <StyleInjector />

      <div className="arc-sidebar-content">
        {/* Pinned Tabs Section */}
        <div
          className="arc-sidebar-section"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          style={{ minHeight: "50px" }} // Ensure there is droppable area even if empty
        >
          <div className="arc-sidebar-section-title">{t("arcTabs.pinned")}</div>
          {currentSpacePinnedBlocks.length === 0 && (
            <div style={{ fontSize: "12px", opacity: 0.5, padding: "0 8px" }}>
              No pinned tabs yet
            </div>
          )}
          {currentSpacePinnedBlocks.map((block) => {
            const isActive = block.id === focusedBlock;
            const title = getBlockDisplayName(block);
            const icon = getBlockIcon(block);
            return (
              <TabItem
                key={block.id}
                blockId={block.id}
                title={title}
                isActive={isActive}
                isPinned={true}
                activeSpace={activeSpace}
                onClick={handleTabClick}
                onPinStateChange={reloadPinnedBlocks}
                icon={icon}
              />
            );
          })}
        </div>

        {/* Today Tabs Section */}
        <div className="arc-sidebar-section">
          <div className="arc-sidebar-section-title">{t("arcTabs.today")}</div>
          {filteredTodayTabs.map((tab) => {
            const block = state.blocks[tab.id];
            const isActive = tab.id === focusedBlock;
            const title = block
              ? getBlockTitle(block, tab.id)
              : tab.title || `Block ${tab.id}`;
            const icon = block ? getBlockIcon(block) : (tab.icon || '📄');
 
            return (
              <TabItem
                key={tab.id}
                blockId={tab.id}
                title={title}
                isActive={isActive}
                isPinned={false}
                activeSpace={activeSpace}
                onClick={handleTabClick}
                onPinStateChange={reloadPinnedBlocks}
                icon={icon}
              />
            );
          })}
        </div>
      </div>

      <div className="arc-sidebar-footer">
        <div
          className={`arc-space-item ${activeSpace === "default" ? "active" : ""}`}
          title={t("arcTabs.defaultSpace")}
          onClick={() => setActiveSpace("default")}
        >
          P
        </div>
        <div className="arc-space-item" title={t("arcTabs.newSpace")}>
          +
        </div>
      </div>
    </div>
  );
};
