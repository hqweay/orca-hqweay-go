import React from "react";

export interface SettingsItemProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}

export function SettingsItem({ label, description, children }: SettingsItemProps) {
  return (
    <div style={{
      marginBottom: "20px",
      display: "flex",
      flexDirection: "column",
      gap: "8px"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: "bold" }}>{label}</div>
        <div>{children}</div>
      </div>
      {description && (
        <div style={{ fontSize: "0.85em", opacity: 0.7 }}>
          {description}
        </div>
      )}
    </div>
  );
}

export function SettingsSection({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "24px" }}>
      <h3 style={{ 
        borderBottom: "1px solid var(--b3-theme-surface-lighter)", 
        paddingBottom: "8px",
        marginBottom: "16px" 
      }}>{title}</h3>
      {children}
    </div>
  );
}
