import React, { useState } from "react";
import { t } from "@/libs/l10n";
import { pinBlock, unpinBlock } from "../utils/pin";
import { removeRecentBlock } from "../utils/recent";
import { BlockIcon } from "../../libs/components/BlockIcon";

interface TabItemProps {
  blockId: number;
  title: string;
  isActive: boolean;
  isPinned: boolean;
  activeSpace: string;
  onClick: (blockId: number) => void;
  icon?: React.ReactNode;
  color?: string;
  displayMode?: "grid" | "list";
}

export const TabItem: React.FC<TabItemProps> = React.memo(({
  blockId,
  title,
  isActive,
  isPinned,
  activeSpace,
  onClick,
  icon,
  color,
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
  };

  const handleDragStart = (e: React.DragEvent) => {
    const repoId = orca.state.repo || "default";
    e.dataTransfer.setData(`orca/${repoId}`, JSON.stringify({ blocks: [blockId] }));
    e.dataTransfer.setData("text/plain", String(blockId));
    e.dataTransfer.effectAllowed = "copy";
  };

  const Tooltip = orca.components.Tooltip;

  if (displayMode === "grid") {
    const hasCustomIcon = icon && icon !== "📄";
    const initialText = title
      ? Array.from(String(title).trim())[0]?.toUpperCase() || "?"
      : "?";

    return (
      <Tooltip text={title}>
        <div
          className={`arc-tab-grid-item ${isActive ? "active" : ""}`}
          draggable
          onDragStart={handleDragStart}
          onClick={() => onClick(blockId)}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {hasCustomIcon ? (
            <div className="arc-tab-grid-icon">
              <BlockIcon iconValue={icon} color={color} />
            </div>
          ) : (
            <span className="arc-tab-initial" style={{ color }}>
              {initialText}
            </span>
          )}
          {isPinned && (isActive || isHovered) && (
            <span
              className="arc-tab-grid-unpin"
              title={t("arc-tabs.unpin")}
              onClick={(e) => {
                e.stopPropagation();
                handleUnpinClick();
              }}
            >
              <i className="ti ti-x" />
            </span>
          )}
        </div>
      </Tooltip>
    );
  }

  return (
    <Tooltip text={title}>
      <div
        className={`arc-tab-item ${isActive ? "active" : ""}`}
        draggable
        onDragStart={handleDragStart}
        onClick={() => onClick(blockId)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <span className="arc-tab-icon">
          <BlockIcon iconValue={icon} color={color} />
        </span>
        <span className="arc-tab-title" style={{ color }}>
          {title}
        </span>

        {isPinned ? (
          <button
            className="arc-tab-action-btn"
            title={t("arc-tabs.unpin")}
            style={{ marginLeft: "8px", flexShrink: 0 }}
            onClick={(e) => {
              e.stopPropagation();
              handleUnpinClick();
            }}
          >
            <i className="ti ti-x" />
          </button>
        ) : (
          <div className="arc-tab-right-zone">
            {isActive || isHovered ? (
              <div
                className="arc-tab-actions"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className="arc-tab-action-btn"
                  title={t("arc-tabs.pin")}
                  onClick={handlePinClick}
                >
                  <i className="ti ti-pin" />
                </button>
                <button
                  className="arc-tab-action-btn"
                  title={t("arc-tabs.close")}
                  onClick={handleCloseClick}
                >
                  <i className="ti ti-x" />
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </Tooltip>
  );
});
