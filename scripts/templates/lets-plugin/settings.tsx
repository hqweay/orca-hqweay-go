import React, { useState } from "react";
import { SettingsItem, SettingsSection } from "@/components/SettingsItem";
import { t } from "@/libs/l10n";

export function __PLUGIN_CLASS_NAME__Settings({ plugin }: { plugin: any }) {
  const settings = plugin["getSettings"]();
  const [config, setConfig] = useState(settings);

  const updateConfig = async (key: string, value: any) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    await plugin["updateSettings"](newConfig);
  };

  const Input = orca.components.Input;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
      <SettingsSection title={t("General")}>
        <SettingsItem
          label={t("Example Setting")}
          description={t("This is an example setting")}
        >
          <Input
            value={config.exampleSetting || ""}
            onChange={(e: any) => updateConfig("exampleSetting", e.target.value)}
          />
        </SettingsItem>
      </SettingsSection>
    </div>
  );
}
