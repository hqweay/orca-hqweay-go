import React, { useState } from "react";
import { SettingsItem, SettingsSection } from "./SettingsItem";
import { t } from "@/libs/l10n";

interface PluginSettingsProps {
  plugin: {
    headbarButtonId?: string | null;
    getSettings: () => any;
    updateSettings: (settings: any) => Promise<void>;
    renderCustomSettings: (
      settings: any,
      updateSettings: (val: any) => void,
    ) => React.ReactNode;
  };
}

export function PluginSettings({ plugin }: PluginSettingsProps) {
  const [settings, setSettings] = useState(plugin.getSettings());

  const updateLocalSettings = async (partial: any) => {
    const nextSettings = { ...settings, ...partial };
    setSettings(nextSettings);
    await plugin.updateSettings(partial);
  };

  const hasHeadbar = !!plugin.headbarButtonId;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {hasHeadbar && (
        <SettingsSection title={t("Headbar Display Mode")}>
          <SettingsItem label={t("Display Mode")}>
            <orca.components.Select
              selected={[settings.headbarMode || "both"]}
              options={[
                { value: "actions", label: t("Actions Menu") },
                { value: "standalone", label: t("Standalone Button") },
                { value: "both", label: t("Both") },
              ]}
              onChange={(selected) =>
                updateLocalSettings({ headbarMode: selected[0] })
              }
            />
          </SettingsItem>
        </SettingsSection>
      )}
      {plugin.renderCustomSettings(settings, updateLocalSettings)}
    </div>
  );
}
