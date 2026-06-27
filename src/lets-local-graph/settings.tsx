import React from "react";
import { SettingsItem, SettingsSection } from "@/components/SettingsItem";

interface LocalGraphSettingsProps {
  settings: any;
  updateSettings: (key: string, value: any) => void;
  t: (key: string, args?: { [key: string]: string }) => string;
}

export const LocalGraphSettings: React.FC<LocalGraphSettingsProps> = ({
  settings,
  updateSettings,
  t,
}) => {
  const Input = orca.components.Input;

  return (
    <div>
      <SettingsSection title={t("settings")}>
        <SettingsItem
          label={t("maxDegree")}
          description={t("maxDegreeDesc")}
        >
          <Input
            value={settings.maxDegree}
            type="number"
            min={1}
            max={200}
            onChange={(e: any) =>
              updateSettings("maxDegree", parseInt(e.target.value) || 40)
            }
          />
        </SettingsItem>

        <SettingsItem
          label={t("maxNodes")}
          description={t("maxNodesDesc")}
        >
          <Input
            value={settings.maxNodes}
            type="number"
            min={10}
            max={1000}
            onChange={(e: any) =>
              updateSettings("maxNodes", parseInt(e.target.value) || 300)
            }
          />
        </SettingsItem>

        <SettingsItem
          label={t("excludedTags")}
          description={t("excludedTagsDesc")}
        >
          <Input
            value={settings.excludedTags}
            onChange={(e: any) =>
              updateSettings("excludedTags", e.target.value)
            }
            placeholder="#Journal, #TODO"
          />
        </SettingsItem>
      </SettingsSection>
    </div>
  );
};
