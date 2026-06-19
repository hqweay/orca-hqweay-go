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
  icon?: React.ReactNode;
  color?: string;
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

  const Tooltip = orca.components.Tooltip;

  const renderIcon = (iconValue?: React.ReactNode, fallback: React.ReactNode = "📄") => {
    if (!iconValue) return <span style={{ color }}>{fallback}</span>;
    if (typeof iconValue === "string") {
      if (iconValue.startsWith("ti ")) {
        return <i className={iconValue} style={{ fontSize: "16px", color }} />;
      }
      if (iconValue.startsWith("__journal__:")) {
        const dateStr = iconValue.replace("__journal__:", "");
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          const day = String(d.getDate()).padStart(2, "0");
          const monthStr = [
            "JAN", "FEB", "MAR", "APR", "MAY", "JUN", 
            "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"
          ][d.getMonth()];
          
          return (
            <svg
              width="20"
              height="20"
              viewBox="0 0 22 18"
              xmlns="http://www.w3.org/2000/svg"
              style={{ flexShrink: 0 }}
            >
              <rect
                x="1.5"
                y="1.5"
                width="18"
                height="18"
                rx="3"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path d="M1.5 6.5 L18.5 6.5" stroke="currentColor" strokeWidth="1.5" />
              <text
                x="10"
                y="4.2"
                fontSize="3.5"
                fontWeight="800"
                textAnchor="middle"
                dominantBaseline="central"
                fill="currentColor"
                fontFamily="sans-serif"
              >
                {monthStr}
              </text>
              <text
                x="10"
                y="11.2"
                fontSize="7.5"
                fontWeight="800"
                textAnchor="middle"
                dominantBaseline="central"
                fill="currentColor"
                fontFamily="sans-serif"
              >
                {day}
              </text>
            </svg>
          );
        }
      }
    }
    return <span style={{ color, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{iconValue}</span>;
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
          {hasCustomIcon ? renderIcon(icon) : <span className="arc-tab-initial" style={{ color }}>{initialText}</span>}
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
        <span className="arc-tab-title" style={{ color }}>{title}</span>

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
