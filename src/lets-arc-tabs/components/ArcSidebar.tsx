import React, { useMemo, useState, useEffect } from "react";
import { useSnapshot } from "valtio";
import { t } from "@/libs/l10n";

import styles from "../styles.css?inline";
import {
  getActiveBlocks,
  findMainPanelId,
  getFocusedBlock,
} from "../utils/nav";
import { arcTabsState, DEFAULT_SPACE } from "../utils/data";
import { pinBlock, loadPinnedBlocks } from "../utils/pin";
import { getSpaces, getBlocksInSpace, addSpaceChoice, loadSpacesFromTag } from "../utils/spaces";
import { addRecentBlock } from "../utils/recent";
import { TabItem } from "./TabItem";
import { arcTabsPluginInstance } from "../index";

const getBlockTitle = (block: any, id: string | number) => {
  if (!block) return `Block ${String(id).substring(0, 8)}`;

  const pinTagName = arcTabsPluginInstance?.getSettings()?.pinTagName || "ArcTab";
  const tagRef = block.refs?.find((r: any) => r.alias === pinTagName);
  
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
    loadPinnedBlocks();
  }, [activeSpace]);

  const openBlockIds = useMemo(
    () => getActiveBlocks(state.panels).map(Number),
    [state.panels],
  );

  const currentSpacePinnedBlocks = useMemo(() => {
    const blocks = activeSpace
      ? getBlocksInSpace(activeSpace)
      : localArcTabsState.pinnedBlocks;

    return blocks.map((b) => {
      const fullBlock = state.blocks[b.id] || b;
      return {
        ...b,
        _title: getBlockTitle(fullBlock, b.id),
        _icon: getBlockIcon(fullBlock),
      };
    });
  }, [localArcTabsState.pinnedBlocks, activeSpace, state.blocks]);

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
    const currentSpacePinnedIds = getBlocksInSpace(activeSpace || DEFAULT_SPACE).map((b) => b.id);
    return localArcTabsState.recentlyVisited
      .filter((item) => !currentSpacePinnedIds.includes(item.id))
      .slice(0, 15);
  }, [localArcTabsState.recentlyVisited, localArcTabsState.pinnedBlocks, activeSpace]);

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

  const handleTabClick = (blockId: number) => {
    const mainPanelId = findMainPanelId(state.panels, state.activePanel);
    if (mainPanelId) {
      orca.nav.goTo("block", { blockId }, mainPanelId);
      orca.nav.switchFocusTo(mainPanelId);
    } else {
      const sidebarPanelId = orca.state.activePanel;
      orca.nav.addTo(sidebarPanelId, "right", {
        view: "block",
        viewArgs: { blockId },
        viewState: {},
      });
    }
  };

  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set to false if we're leaving the drop zone entirely
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragOver(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    try {
      const types = Array.from(e.dataTransfer.types);
      
      // Orca uses custom MIME types like "orca/_doc_8" for block drags
      const orcaCustomType = types.find(t => t.startsWith("orca/"));
      const orcaCustomData = orcaCustomType ? e.dataTransfer.getData(orcaCustomType) : "";
      const textData = e.dataTransfer.getData("text/plain");
      const jsonData = e.dataTransfer.getData("application/json");
      const orcaBlocks = e.dataTransfer.getData("application/x-orca-blocks");
      const textHtml = e.dataTransfer.getData("text/html");

      // Try to extract block ID from various data formats
      let ids: string[] = [];
      
      // 0. Try Orca custom type data first (highest priority)
      // Orca uses format: {"blocks": [blockId, ...]}
      if (orcaCustomData) {
        try {
          const parsed = JSON.parse(orcaCustomData);
          if (parsed && Array.isArray(parsed.blocks)) {
            ids = parsed.blocks.map(String);
          } else if (parsed && parsed.id) {
            ids.push(String(parsed.id));
          } else if (parsed && parsed.blockId) {
            ids.push(String(parsed.blockId));
          }
        } catch (e) {
          // Not JSON, try as plain text block ID
          const numId = Number(orcaCustomData);
          if (!isNaN(numId) && numId > 0) {
            ids.push(String(numId));
          }
        }
      }
      
      // 1. Try JSON data
      if (ids.length === 0 && jsonData) {
        try {
          const parsed = JSON.parse(jsonData);
          if (parsed.id) ids.push(String(parsed.id));
          else if (Array.isArray(parsed.blockIds)) ids = parsed.blockIds.map(String);
          else if (Array.isArray(parsed) && parsed[0]?.id) ids = parsed.map((b: any) => String(b.id));
        } catch (e) {
          // ignore
        }
      }
      
      // 2. Try orca-blocks data
      if (ids.length === 0 && orcaBlocks) {
        try {
          const parsed = JSON.parse(orcaBlocks);
          if (parsed.id) ids.push(String(parsed.id));
          else if (Array.isArray(parsed.blockIds)) ids = parsed.blockIds.map(String);
          else if (Array.isArray(parsed) && parsed[0]?.id) ids = parsed.map((b: any) => String(b.id));
        } catch (e) {
          // ignore
        }
      }
      
      // 3. Try text data (might be a block ID or URL)
      if (ids.length === 0 && textData) {
        const numId = Number(textData);
        if (!isNaN(numId) && numId > 0) {
          ids.push(String(numId));
        } else {
          const blockMatch = textData.match(/(?:block\/|#)(\d+)/);
          if (blockMatch) {
            ids.push(blockMatch[1]);
          }
        }
      }

      // 4. Try HTML data (might contain block ID in data attribute)
      if (ids.length === 0 && textHtml) {
        const blockMatch = textHtml.match(/data-block-id="(\d+)"/);
        if (blockMatch) {
          ids.push(blockMatch[1]);
        }
      }
      
      if (ids.length === 0) {
        return;
      }

      const targetSpace = activeSpace || spaces[0] || DEFAULT_SPACE;
      for (const id of ids) {
        const numId = Number(id);
        if (!isNaN(numId) && numId > 0) {
          await pinBlock(numId, targetSpace);
        }
      }
    } catch (err) {
      console.error("[ArcTabs] Failed to handle drop:", err);
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
          className={`arc-sidebar-section arc-drop-zone ${isDragOver ? "drag-over" : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{ minHeight: "50px" }}
        >
          <div className="arc-sidebar-section-title">{t("arc-tabs.pinned")}</div>
          {currentSpacePinnedBlocks.length === 0 && (
            <div className={`arc-drop-hint ${isDragOver ? "drag-over" : ""}`}>
              {isDragOver ? "释放以固定" : t("arc-tabs.noPinned")}
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
                    activeSpace={activeSpace || spaces[0] || DEFAULT_SPACE}
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
                  activeSpace={activeSpace || spaces[0] || DEFAULT_SPACE}
                  onClick={handleTabClick}
                  icon={block._icon}
                  displayMode="list"
                />
              );
            })
          )}
        </div>

        {/* Today Tabs Section */}
        <div className="arc-sidebar-section arc-today-tabs">
          <div className="arc-sidebar-section-title">{t("arc-tabs.today")}</div>
          {todayTabs.map((tab) => {
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
                activeSpace={activeSpace || spaces[0] || DEFAULT_SPACE}
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
            {Array.from(space)[0]?.toUpperCase()}
          </div>
        ))}

        <div
          className="arc-space-item arc-space-add"
          title={t("arc-tabs.newSpace")}
          onClick={() => setShowNewSpaceInput(true)}
        >
          +
        </div>
      </div>

      {showNewSpaceInput && (
        <orca.components.ModalOverlay
          visible={showNewSpaceInput}
          onClose={() => {
            setShowNewSpaceInput(false);
            setNewSpaceName("");
          }}
          blurred={true}
          style={{
            backgroundColor: "rgba(0, 0, 0, 0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              background: "var(--orca-color-bg-1)",
              color: "var(--orca-text-color)",
              padding: "20px",
              borderRadius: "12px",
              width: "320px",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)",
              border: "1px solid var(--orca-color-border-2)",
            }}
          >
            <h3 style={{ margin: "0 0 16px 0", fontSize: "15px", fontWeight: 600 }}>
              {t("arc-tabs.newSpace")}
            </h3>
            <orca.components.Input
              value={newSpaceName}
              onChange={(e: any) => setNewSpaceName(e.target.value)}
              onKeyDown={(e: any) => {
                if (e.key === "Enter") handleNewSpace();
                if (e.key === "Escape") {
                  setShowNewSpaceInput(false);
                  setNewSpaceName("");
                }
              }}
              placeholder={t("arc-tabs.spaceName")}
              autoFocus
              width="100%"
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "16px" }}>
              <orca.components.Button
                variant="plain"
                onClick={() => {
                  setShowNewSpaceInput(false);
                  setNewSpaceName("");
                }}
              >
                {t("cancel")}
              </orca.components.Button>
              <orca.components.Button
                variant="solid"
                onClick={handleNewSpace}
                disabled={!newSpaceName.trim()}
              >
                {t("create")}
              </orca.components.Button>
            </div>
          </div>
        </orca.components.ModalOverlay>
      )}
    </div>
  );
};
