import React, { useState } from "react";
import { SettingsItem, SettingsSection } from "./SettingsItem";
import { t } from "@/libs/l10n";

interface PluginSettingsProps {
  plugin: {
    headbarButtonId?: string | null;
    getSettings: () => any;
    updateSettings: (settings: any) => Promise<void>;
  };
  customSettings?: React.ReactNode;
}

export function PluginSettings({
  plugin,
  customSettings,
}: PluginSettingsProps) {
  const settings = plugin.getSettings();
  const hasHeadbar = !!plugin.headbarButtonId;
  const [headbarMode, setHeadbarMode] = useState(
    settings.headbarMode || "both",
  );

  // Sync state when plugin prop changes (e.g. switching plugins in settings)
  // useState initializer only runs on mount, so without this,
  // the mode would be stale when reusing the component.
  React.useEffect(() => {
    const currentSettings = plugin.getSettings();
    setHeadbarMode(currentSettings.headbarMode || "both");
  }, [plugin]);

  const updateMode = async (value: string) => {
    setHeadbarMode(value);
    await plugin.updateSettings({ headbarMode: value });
  };

  if (!hasHeadbar && !customSettings) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {hasHeadbar && (
        <SettingsSection title={t("Headbar Display Mode")}>
          <SettingsItem label={t("Display Mode")}>
            <orca.components.Select
              selected={[headbarMode]}
              options={[
                { value: "actions", label: t("Actions Menu") },
                { value: "standalone", label: t("Standalone Button") },
                { value: "both", label: t("Both") },
              ]}
              onChange={(selected) => updateMode(selected[0])}
            />
          </SettingsItem>
        </SettingsSection>
      )}
      {customSettings}
    </div>
  );
}
