import React, { useState } from "react";
import { pinBlock, unpinBlock, removeRecentBlock } from "../utils/data";

interface TabItemProps {
  blockId: number;
  title: string;
  isActive: boolean;
  isPinned: boolean;
  activeSpace: string;
  onClick: (blockId: number) => void;
  icon?: string;
  displayMode?: "grid" | "list";
}

export const TabItem: React.FC<TabItemProps> = ({
  blockId,
  title,
  isActive,
  isPinned,
  activeSpace,
  onClick,
  icon,
  displayMode = "list",
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const handlePinClick = async () => {
    if (!isPinned) {
      await pinBlock(blockId, activeSpace);
    }
  };

  const handleUnpinClick = async () => {
    if (isPinned) {
      await unpinBlock(blockId);
    }
  };

  const handleCloseClick = () => {
    removeRecentBlock(blockId);

    const panels = orca.state.panels;
    const findPanelIdByBlockId = (panel: any): string | null => {
      if (
        panel.view === "block" &&
        Number(panel.viewArgs?.blockId) === blockId
      ) {
        return panel.id;
      }
      if (panel.children) {
        for (const child of panel.children) {
          const found = findPanelIdByBlockId(child);
          if (found) return found;
        }
      }
      return null;
    };

    const panelId = findPanelIdByBlockId(panels);
    if (panelId) {
      orca.nav.close(panelId);
    }
  };

  const Tooltip = orca.components.Tooltip;

  if (displayMode === "grid") {
    const hasCustomIcon = icon && icon !== "📄";
    const displayIcon = hasCustomIcon ? icon : null;
    const initialText = title
      ? String(title).trim().substring(0, 1).toUpperCase()
      : "?";

    return (
      <Tooltip text={title}>
        <div
          className={`arc-tab-grid-item ${isActive ? "active" : ""}`}
          onClick={() => onClick(blockId)}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {isHovered ? (
            <span
              className="arc-tab-unpin-btn"
              title="Unpin"
              onClick={(e) => {
                e.stopPropagation();
                handleUnpinClick();
              }}
            >
              <i className="ti ti-x" />
            </span>
          ) : displayIcon ? (
            displayIcon
          ) : (
            <span className="arc-tab-initial">{initialText}</span>
          )}
        </div>
      </Tooltip>
    );
  }

  return (
    <Tooltip text={title}>
      <div
        className={`arc-tab-item ${isActive ? "active" : ""}`}
        onClick={() => onClick(blockId)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <span className="arc-tab-icon">{icon || "📄"}</span>
        <span className="arc-tab-title">{title}</span>

        {isPinned ? (
          <button
            className="arc-tab-action-btn"
            title="Unpin"
            style={{ marginLeft: '8px', flexShrink: 0 }}
            onClick={(e) => { e.stopPropagation(); handleUnpinClick(); }}
          >
            <i className="ti ti-x" />
          </button>
        ) : isHovered ? (
          <div className="arc-tab-actions" onClick={(e) => e.stopPropagation()}>
            <button
              className="arc-tab-action-btn"
              title="Pin"
              onClick={handlePinClick}
            >
              <i className="ti ti-pin" />
            </button>
            <button
              className="arc-tab-action-btn"
              title="Close"
              onClick={handleCloseClick}
            >
              <i className="ti ti-x" />
            </button>
          </div>
        ) : (
          isActive && <div className="arc-tab-active-dot" />
        )}
      </div>
    </Tooltip>
  );
};
