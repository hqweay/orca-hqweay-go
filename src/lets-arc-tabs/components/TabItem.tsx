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

  const handleDragStart = (e: React.DragEvent) => {
    const repoId = orca.state.repo || "default";
    e.dataTransfer.setData(`orca/${repoId}`, JSON.stringify({ blocks: [blockId] }));
    e.dataTransfer.setData("text/plain", String(blockId));
    e.dataTransfer.effectAllowed = "copy";
  };

  const Tooltip = orca.components.Tooltip;

  const renderIcon = (
    iconValue?: React.ReactNode,
    fallback: React.ReactNode = "📄",
  ) => {
    if (!iconValue) return <span style={{ color }}>{fallback}</span>;
    if (typeof iconValue === "string") {
      if (iconValue.startsWith("ti ")) {
        return <i className={iconValue} style={{ fontSize: "16px", color }} />;
      }
      if (iconValue.startsWith("__journal__:")) {
        const dateStr = iconValue.replace("__journal__:", "");
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          const day = d.getDate();
          const monthNames = [
            "1月",
            "2月",
            "3月",
            "4月",
            "5月",
            "6月",
            "7月",
            "8月",
            "9月",
            "10月",
            "11月",
            "12月",
          ];
          const month = monthNames[d.getMonth()];

          return (
            <svg
              width="18"
              height="18"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ flexShrink: 0, verticalAlign: "middle" }}
            >
              <rect x="2" y="2" width="16" height="16" rx="3" fill="#DBEAFE" />
              <rect
                x="2"
                y="2"
                width="16"
                height="16"
                rx="3"
                stroke="#60A5FA"
                strokeWidth="1"
              />
              <rect x="2" y="2" width="16" height="6" rx="2" fill="#1D4ED8" />
              <text
                x="10"
                y="5.5"
                fontSize="4.5"
                fontWeight="700"
                textAnchor="middle"
                dominantBaseline="central"
                fill="#F0F9FF"
                fontFamily="system-ui, -apple-system, sans-serif"
              >
                {month}
              </text>
              <text
                x="10"
                y="13"
                fontSize="8"
                fontWeight="700"
                textAnchor="middle"
                dominantBaseline="central"
                fill="#1E40AF"
                fontFamily="system-ui, -apple-system, sans-serif"
              >
                {day}
              </text>
            </svg>
          );
        }
      }
    }
    return (
      <span
        style={{
          color,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {iconValue}
      </span>
    );
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
          draggable
          onDragStart={handleDragStart}
          onClick={() => onClick(blockId)}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {hasCustomIcon ? (
            renderIcon(icon)
          ) : (
            <span className="arc-tab-initial" style={{ color }}>
              {initialText}
            </span>
          )}
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
        draggable
        onDragStart={handleDragStart}
        onClick={() => onClick(blockId)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <span className="arc-tab-icon">{renderIcon(icon)}</span>
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
            {isHovered ? (
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
            ) : isActive ? (
              <div className="arc-tab-active-dot" />
            ) : null}
          </div>
        )}
      </div>
    </Tooltip>
  );
};
