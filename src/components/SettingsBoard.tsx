import React, { useState, useEffect } from "react";
import { pluginInstances } from "@/main";
import { t } from "@/libs/l10n";

interface SettingsBoardProps {
  onClose: () => void;
  mainPluginName: string;
}

export function SettingsBoard({ onClose, mainPluginName }: SettingsBoardProps) {
  const [activePlugin, setActivePlugin] = useState<string | null>(null);

  // Filter only enabled plugins
  const enabledPlugins = pluginInstances.filter(p => {
    const settings = orca.state.plugins[mainPluginName]?.settings;
    return settings?.[p["name"]]; // p["name"] is the sub-plugin name
  });

  useEffect(() => {
    if (enabledPlugins.length > 0 && !activePlugin) {
      setActivePlugin(enabledPlugins[0]["name"]);
    }
  }, [enabledPlugins]);

  const currentPlugin = enabledPlugins.find(p => p["name"] === activePlugin);
  const Button = orca.components.Button;

  return (
    <orca.components.ModalOverlay
      visible={true}
      onClose={onClose}
      blurred={true}
      style={{
        backgroundColor: "rgba(255, 255, 255, 0.9)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "var(--b3-theme-background)",
          color: "var(--b3-theme-on-background)",
          width: "900px",
          height: "85vh",
          display: "flex",
          flexDirection: "column",
          borderRadius: "8px",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
          overflow: "hidden",
          border: "1px solid var(--b3-theme-surface-lighter)"
        }}
      >
        {/* Header */}
        <div style={{
          padding: "16px 24px",
          borderBottom: "1px solid var(--b3-theme-surface-lighter)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <h2 style={{ margin: 0, fontSize: "1.25em" }}>{t("Sub-plugin Settings")}</h2>
          <Button variant="plain" onClick={onClose} style={{ padding: "4px", minWidth: "auto" }}>
            <i className="ti ti-x" style={{ fontSize: "20px" }}></i>
          </Button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
          {/* Sidebar */}
          <div style={{
            width: "240px",
            borderRight: "1px solid var(--b3-theme-surface-lighter)",
            background: "var(--b3-theme-surface)",
            padding: "12px 0",
            overflowY: "auto"
          }}>
            {enabledPlugins.length === 0 ? (
              <div style={{ padding: "12px 20px", opacity: 0.5, fontSize: "0.9em" }}>
                {t("No enabled plugins")}
              </div>
            ) : (
              enabledPlugins.map(p => (
                <div
                  key={p["name"]}
                  onClick={() => setActivePlugin(p["name"])}
                  style={{
                    padding: "12px 24px",
                    cursor: "pointer",
                    background: activePlugin === p["name"] ? "var(--b3-theme-surface-lighter)" : "transparent",
                    color: activePlugin === p["name"] ? "var(--b3-theme-primary)" : "inherit",
                    fontWeight: activePlugin === p["name"] ? "600" : "normal",
                    borderLeft: activePlugin === p["name"] ? "4px solid var(--b3-theme-primary)" : "4px solid transparent",
                    transition: "all 0.2s ease"
                  }}
                >
                  {p["name"]}
                </div>
              ))
            )}
          </div>

          {/* Main Area */}
          <div style={{ flex: 1, padding: "24px 32px", overflowY: "auto" }}>
            {currentPlugin ? (
              <div>
                <h1 style={{ marginTop: 0, marginBottom: "24px", fontSize: "1.5em" }}>{activePlugin}</h1>
                {currentPlugin.renderSettings()}
              </div>
            ) : (
              <div style={{ 
                height: "100%", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center",
                opacity: 0.5
              }}>
                {t("Select a plugin from the sidebar")}
              </div>
            )}
          </div>
        </div>
      </div>
    </orca.components.ModalOverlay>
  );
}
