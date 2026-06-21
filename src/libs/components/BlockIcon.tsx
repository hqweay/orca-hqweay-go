import React from "react";

export interface BlockIconProps {
  iconValue?: React.ReactNode;
  color?: string;
  fallback?: React.ReactNode;
  className?: string;
}

export const BlockIcon: React.FC<BlockIconProps> = ({
  iconValue,
  color,
  fallback = "📄",
  className,
}) => {
  if (!iconValue) {
    return (
      <span className={className} style={{ color }}>
        {fallback}
      </span>
    );
  }

  if (typeof iconValue === "string") {
    let strValue = iconValue;
    if (strValue.startsWith("ti ")) {
      return (
        <i
          className={`${strValue} ${className || ""}`}
          style={{ fontSize: "16px", color }}
        />
      );
    }
    if (strValue.startsWith("__journal__:__journal__:__journal__:__journal__:")) {
      // Fix bad data if any
      strValue = strValue.replace(/__journal__:/g, "")
      strValue = `__journal__:${strValue}`
    }
    if (strValue.startsWith("__journal__:")) {
      const dateStr = strValue.replace("__journal__:", "");
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
            className={className}
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
      className={className}
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
