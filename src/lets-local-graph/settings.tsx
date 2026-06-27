import React from "react";
import { SettingsItem, SettingsSection } from "@/components/SettingsItem";
import { t } from "@/libs/l10n";

interface LocalGraphSettingsProps {
  settings: any;
  updateSettings: (key: string, value: any) => void;
}

export const LocalGraphSettings: React.FC<LocalGraphSettingsProps> = ({
  settings,
  updateSettings,
}) => {
  const Input = orca.components.Input;

  return (
    <div>
      <SettingsSection title={t("Local Graph Options")}>
        <SettingsItem
          label={t("Max Degree per Node")}
          description={t(
            "Maximum number of references to explore per node. Protects against tag blackholes.",
          )}
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
          label={t("Global Node Limit")}
          description={t(
            "Maximum number of total nodes in the graph to prevent lag.",
          )}
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
          label={t("Excluded Tags")}
          description={t(
            "Comma-separated tags to treat as blackhole leaves (e.g. #Journal, #TODO).",
          )}
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
