import React, { useState } from "react";
import { t } from "@/libs/l10n";
import { pinBlock, unpinBlock } from "../utils/pin";
import { removeRecentBlock } from "../utils/recent";

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
  };

  const Tooltip = orca.components.Tooltip;

  const renderIcon = (iconValue?: string, fallback: string = "📄") => {
    if (!iconValue) return fallback;
    if (iconValue.startsWith("ti ")) {
      return <i className={iconValue} style={{ fontSize: "16px" }} />;
    }
    return iconValue;
  };

  if (displayMode === "grid") {
    const hasCustomIcon = icon && icon !== "📄";
    const initialText = title
      ? Array.from(String(title).trim())[0]?.toUpperCase() || "?"
      : "?";

    return (
      <Tooltip text={title}>
        <div
          className={`arc-tab-grid-item ${isActive ? "active" : ""}`}
          onClick={() => onClick(blockId)}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {hasCustomIcon ? renderIcon(icon) : <span className="arc-tab-initial">{initialText}</span>}
          {isPinned && isHovered && (
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
        onClick={() => onClick(blockId)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <span className="arc-tab-icon">{renderIcon(icon)}</span>
        <span className="arc-tab-title">{title}</span>

        {isPinned ? (
          <button
            className="arc-tab-action-btn"
            title={t("arc-tabs.unpin")}
            style={{ marginLeft: '8px', flexShrink: 0 }}
            onClick={(e) => { e.stopPropagation(); handleUnpinClick(); }}
          >
            <i className="ti ti-x" />
          </button>
        ) : (
          <div className="arc-tab-right-zone">
            {isHovered ? (
              <div className="arc-tab-actions" onClick={(e) => e.stopPropagation()}>
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
            ) : isActive ? (
              <div className="arc-tab-active-dot" />
            ) : null}
          </div>
        )}
      </div>
    </Tooltip>
  );
};
