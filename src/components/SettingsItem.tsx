import React from "react";

export interface SettingsItemProps {
  label: string;
  description?: string;
  children: React.ReactNode;
  vertical?: boolean;
  /** Where to render the description: above the row ("top") or below it ("bottom"). */
  descriptionPosition?: "top" | "bottom";
}

export function SettingsItem({
  label,
  description,
  children,
  vertical = false,
  descriptionPosition = "bottom",
}: SettingsItemProps) {
  const desc = description && (
    <div style={{ fontSize: "0.85em", opacity: 0.7 }}>{description}</div>
  );
  return (
    <div
      style={{
        marginBottom: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: vertical ? "column" : "row",
          justifyContent: "space-between",
          alignItems: vertical ? "flex-start" : "center",
          gap: vertical ? "12px" : "8px",
        }}
      >
        <div style={{ fontWeight: "bold" }}>{label}</div>
        {descriptionPosition === "top" && desc}
        <div style={{ width: vertical ? "100%" : "auto" }}>{children}</div>
      </div>
      {descriptionPosition === "bottom" && desc}
    </div>
  );
}

export function SettingsSection({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "24px" }}>
      <h3 style={{ 
        borderBottom: "1px solid var(--orca-color-border)", 
        paddingBottom: "8px",
        marginBottom: "16px" 
      }}>{title}</h3>
      {children}
    </div>
  );
}
