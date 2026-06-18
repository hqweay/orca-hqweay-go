import React, { useMemo, useState, useEffect } from "react";
import { useSnapshot } from "valtio";
import { t } from "@/libs/l10n";

import styles from "../styles.css?inline";
import {
  getActiveBlocks,
  findMainPanelId,
  getFocusedBlock,
} from "../utils/nav";
import { arcTabsState } from "../utils/data";
import { pinBlock, loadPinnedBlocks } from "../utils/pin";
import { getSpaces, getBlocksInSpace, addSpaceChoice, loadSpacesFromTag } from "../utils/spaces";
import { addRecentBlock } from "../utils/recent";
import { TabItem } from "./TabItem";
import { arcTabsPluginInstance } from "../index";

const getBlockTitle = (block: any, id: string | number) => {
  if (!block) return `Block ${String(id).substring(0, 8)}`;

  const pinTagName = arcTabsPluginInstance?.getSettings()?.pinTagName || "ArcTab";
  const tagRef = block.refs?.find((r: any) => r.name === pinTagName);
  
  const displayName =
    tagRef?.data?.find((p: any) => p.name === "displayName")?.value ||
    block.properties?.find((p: any) => p.name === "displayName")?.value;
  
  if (displayName) return displayName;
  
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
  
  const iconProp = block.properties?.find((p: any) => p.name === "_icon");
  if (iconProp && iconProp.value) {
    return iconProp.value;
  }
  
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

  const [activeSpace, setActiveSpace] = useState<string | null>(null);
  const [showNewSpaceInput, setShowNewSpaceInput] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState("");
  const spaces = useMemo(() => getSpaces(), [localArcTabsState.pinnedBlocks, localArcTabsState.spaceChoices]);

  useEffect(() => {
    loadPinnedBlocks();
    loadSpacesFromTag().then((choices) => {
      arcTabsState.spaceChoices = choices;
    });
  }, []);

  useEffect(() => {
    if (activeSpace === null && spaces.length > 0) {
      setActiveSpace(spaces[0]);
    }
  }, [spaces, activeSpace]);

  useEffect(() => {
    if (activeSpace) {
      loadPinnedBlocks(activeSpace);
    }
  }, [activeSpace]);



  const openBlockIds = useMemo(
    () => getActiveBlocks(state.panels).map(Number),
    [state.panels],
  );

  const currentSpacePinnedBlocks = useMemo(() => {
    return localArcTabsState.pinnedBlocks.map((b) => {
      const fullBlock = state.blocks[b.id] || b;
      return {
        ...b,
        _title: getBlockTitle(fullBlock, b.id),
        _icon: getBlockIcon(fullBlock),
      };
    });
  }, [localArcTabsState.pinnedBlocks, state.blocks]);

  useEffect(() => {
    let changed = false;
    const list = [...arcTabsState.recentlyVisited];
    openBlockIds.forEach((id) => {
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
  }, [openBlockIds]);

  const todayTabs = useMemo(() => {
    const allPinnedIds = localArcTabsState.pinnedBlocks.map((b) => b.id);
    return localArcTabsState.recentlyVisited
      .filter((item) => !allPinnedIds.includes(item.id))
      .slice(0, 15);
  }, [localArcTabsState.recentlyVisited, localArcTabsState.pinnedBlocks]);

  const focusedBlock = useMemo(() => {
    return getFocusedBlock(state.panels, state.activePanel);
  }, [state.panels, state.activePanel]);

  const isBlockCached = !!(focusedBlock && state.blocks[focusedBlock]);

  useEffect(() => {
    if (focusedBlock) {
      const block = state.blocks[focusedBlock];
      const title = getBlockTitle(block, focusedBlock);
      const icon = getBlockIcon(block);
      addRecentBlock(focusedBlock, title, icon);
    }
  }, [focusedBlock, isBlockCached]);

  const filteredTodayTabs = todayTabs;

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
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    try {
      const textData = e.dataTransfer.getData("text/plain");
      const jsonData = e.dataTransfer.getData("application/json");
      const orcaBlocks = e.dataTransfer.getData("application/x-orca-blocks");

      const data = jsonData || orcaBlocks || textData;
      if (data) {
        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch (err) {
          parsed = data;
        }

        let ids: string[] = [];
        if (typeof parsed === "object" && parsed !== null) {
          if (parsed.id) ids.push(parsed.id);
          else if (Array.isArray(parsed.blockIds)) ids = parsed.blockIds;
          else if (Array.isArray(parsed) && parsed[0]?.id)
            ids = parsed.map((b: any) => b.id);
        } else if (typeof parsed === "string") {
          ids.push(parsed);
        }

        for (const id of ids) {
          const numId = Number(id);
          if (!isNaN(numId)) {
            await pinBlock(numId, activeSpace || spaces[0] || "default");
          }
        }
      }
    } catch (err) {
      console.error("Failed to parse dropped block data", err);
    }
  };

  const handleNewSpace = async () => {
    if (newSpaceName.trim()) {
      const name = newSpaceName.trim();
      await addSpaceChoice(name);
      setActiveSpace(name);
      setNewSpaceName("");
      setShowNewSpaceInput(false);
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
          style={{ minHeight: "50px" }}
        >
          <div className="arc-sidebar-section-title">{t("arcTabs.pinned")}</div>
          {currentSpacePinnedBlocks.length === 0 && (
            <div style={{ fontSize: "12px", opacity: 0.5, padding: "0 8px" }}>
              No pinned tabs yet
            </div>
          )}
          {localArcTabsState.pinnedDisplayMode === 'grid' ? (
            <div className="arc-pinned-grid">
              {currentSpacePinnedBlocks.map((block) => {
                const isActive = openBlockIds.includes(block.id);
                return (
                  <TabItem
                    key={block.id}
                    blockId={block.id}
                    title={block._title}
                    isActive={isActive}
                    isPinned={true}
                    activeSpace={activeSpace || spaces[0] || "default"}
                    onClick={handleTabClick}
                    icon={block._icon}
                    displayMode="grid"
                  />
                );
              })}
            </div>
          ) : (
            currentSpacePinnedBlocks.map((block) => {
              const isActive = openBlockIds.includes(block.id);
              return (
                <TabItem
                  key={block.id}
                  blockId={block.id}
                  title={block._title}
                  isActive={isActive}
                  isPinned={true}
                  activeSpace={activeSpace || spaces[0] || "default"}
                  onClick={handleTabClick}
                  icon={block._icon}
                  displayMode="list"
                />
              );
            })
          )}
        </div>

        {/* Today Tabs Section */}
        <div className="arc-sidebar-section">
          <div className="arc-sidebar-section-title">{t("arcTabs.today")}</div>
          {filteredTodayTabs.map((tab) => {
            const block = state.blocks[tab.id];
            const isActive = openBlockIds.includes(tab.id);
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
                activeSpace={activeSpace || spaces[0] || "default"}
                onClick={handleTabClick}
                icon={icon}
              />
            );
          })}
        </div>
      </div>

      <div className="arc-sidebar-footer">
        {spaces.map((space) => (
          <div
            key={space}
            className={`arc-space-item ${activeSpace === space ? "active" : ""}`}
            title={space}
            onClick={() => setActiveSpace(space)}
          >
            {space.charAt(0).toUpperCase()}
          </div>
        ))}

        {showNewSpaceInput ? (
          <input
            className="arc-space-input"
            value={newSpaceName}
            onChange={(e) => setNewSpaceName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleNewSpace();
              if (e.key === "Escape") {
                setShowNewSpaceInput(false);
                setNewSpaceName("");
              }
            }}
            onBlur={() => {
              if (!newSpaceName.trim()) {
                setShowNewSpaceInput(false);
              }
            }}
            autoFocus
            placeholder="Space name"
          />
        ) : (
          <div
            className="arc-space-item arc-space-add"
            title={t("arcTabs.newSpace")}
            onClick={() => setShowNewSpaceInput(true)}
          >
            +
          </div>
        )}
      </div>


    </div>
  );
};
